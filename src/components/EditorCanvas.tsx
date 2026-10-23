import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  BrushShape,
  Camera,
  GlyphModel,
  Outline,
  Point,
  Selection,
  StrokeKind,
  Tool,
} from "../types";
import {
  activePoint,
  clamp,
  clone,
  outlineText,
  parseOutline,
  round,
  shiftedOutline,
} from "../lib/geometry";
import { Glyph } from "./Glyph";
import { OutlineOverlay } from "./OutlineOverlay";
import { anchoredCamera, canvasViewport, zoomCamera } from "../lib/viewport";

type Drag = { pointer: number; start: Point } & (
  | { type: "pan"; camera: Camera }
  | { type: "stroke"; previous: GlyphModel }
  | {
      type: "point";
      previous: GlyphModel;
      source: Outline;
      selection: Selection;
    }
);
type Props = {
  model: GlyphModel;
  tool: Tool;
  brush: number;
  brushShape: BrushShape;
  guides: boolean;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  busy: boolean;
  onChange: (model: GlyphModel) => void;
  onCommit: (previous: GlyphModel) => void;
  onGesture: (active: boolean) => void;
  notify: (message: string, error?: boolean) => void;
};
export function EditorCanvas(props: Props) {
  const {
    model,
    tool,
    brush,
    brushShape,
    guides,
    camera,
    onCameraChange,
    busy,
    onChange,
    onCommit,
    onGesture,
    notify,
  } = props;
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null),
    liveModel = useRef(model);
  liveModel.current = model;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [space, setSpace] = useState(false),
    [panning, setPanning] = useState(false);
  const [bounds, setBounds] = useState({ width: 620, height: 620 });
  const spaceHeld = useRef(false),
    touches = useRef(new Map<number, Point>());
  const pinch = useRef<{
    zoom: number;
    distance: number;
    anchor: Point;
  } | null>(null);
  const outline = useMemo(() => parseOutline(model.basePath), [model.basePath]),
    point = activePoint(outline, selection);
  const view = canvasViewport(camera, bounds),
    unit = view.unit;
  const publish = (next: GlyphModel) => {
    liveModel.current = next;
    onChange(next);
  };
  const setView = useCallback(
    (next: Camera) => {
      onCameraChange(next);
      setCursor(null);
    },
    [onCameraChange],
  );
  function zoomTo(value: number, anchor?: Point) {
    if (drag.current) return;
    setView(
      zoomCamera(
        camera,
        value,
        anchor || (tool === "points" && point) || undefined,
      ),
    );
  }
  const position = (
    event: { clientX: number; clientY: number },
    bounded = true,
  ): Point => {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return bounded
      ? [round(clamp(p.x, 0, 1000)), round(clamp(p.y, 0, 1000))]
      : [p.x, p.y];
  };
  function finish(pointer: number, cancel = false) {
    const current = drag.current;
    if (!current || pointer !== current.pointer) return;
    drag.current = null;
    onGesture(false);
    setPanning(false);
    if (current.type === "pan") {
      if (cancel) setView(current.camera);
    } else {
      const next = liveModel.current,
        op = next.operations.at(-1);
      const invalidCut =
        current.type === "stroke" &&
        op?.kind === "cut" &&
        (op.points.length < 2 ||
          Math.abs(op.points[0][0] - op.points.at(-1)![0]) < 1 ||
          Math.abs(op.points[0][1] - op.points.at(-1)![1]) < 1);
      if (cancel || invalidCut) publish(current.previous);
      else if (JSON.stringify(next) !== JSON.stringify(current.previous))
        onCommit(current.previous);
    }
    if (svg.current?.hasPointerCapture(pointer))
      svg.current.releasePointerCapture(pointer);
  }
  function nudge(dx: number, dy: number) {
    if (!selection || !outline || busy || drag.current) return;
    const next = outlineText(shiftedOutline(outline, selection, dx, dy));
    if (next === model.basePath) return;
    onCommit(model);
    publish({
      ...model,
      originalPath: model.originalPath || model.basePath,
      basePath: next,
    });
  }
  useEffect(() => {
    setCursor(null);
  }, [tool]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setBounds({
        width: entry.contentRect.width || 620,
        height: entry.contentRect.height || 620,
      }),
    );
    observer.observe(svg.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = svg.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTo(
        camera.zoom * Math.exp(-clamp(event.deltaY, -300, 300) * 0.0025),
        position(event, false),
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input,textarea,select,dialog") || busy)
        return;
      if (e.code === "Space" && !(e.target as Element).closest("button,a")) {
        e.preventDefault();
        spaceHeld.current = true;
        setSpace(true);
        setCursor(null);
      }
      if (e.key === "Escape" && drag.current)
        finish(drag.current.pointer, true);
      if (drag.current) return;
      if (
        tool === "points" &&
        selection &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      }
      if (e.key === "0") {
        e.preventDefault();
        setView({ x: 0, y: 0, zoom: 1 });
      }
      if (!e.ctrlKey && !e.metaKey && ["+", "="].includes(e.key)) {
        e.preventDefault();
        zoomTo(camera.zoom * 1.5);
      }
      if (!e.ctrlKey && !e.metaKey && e.key === "-") {
        e.preventDefault();
        zoomTo(camera.zoom / 1.5);
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        setSpace(false);
      }
    };
    const blur = () => {
      spaceHeld.current = false;
      setSpace(false);
      if (drag.current) finish(drag.current.pointer, true);
      touches.current.clear();
      pinch.current = null;
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  });
  function pointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (
      busy ||
      !model.basePath ||
      (e.pointerType === "mouse" && ![0, 1].includes(e.button))
    )
      return;
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.current.size === 2) {
        if (drag.current) finish(drag.current.pointer, true);
        const [a, b] = [...touches.current.values()];
        pinch.current = {
          zoom: camera.zoom,
          distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
          anchor: position(
            { clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 },
            false,
          ),
        };
        for (const id of touches.current.keys())
          e.currentTarget.setPointerCapture(id);
        e.preventDefault();
        return;
      }
      if (pinch.current || touches.current.size > 2) return;
    }
    if (drag.current) return;
    e.preventDefault();
    e.currentTarget.focus();
    if (spaceHeld.current || e.button === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      onGesture(true);
      setPanning(true);
      drag.current = {
        type: "pan",
        pointer: e.pointerId,
        start: [e.clientX, e.clientY],
        camera,
      };
      return;
    }
    if (tool === "points") {
      const hit = (e.target as Element).closest<SVGElement>("[data-contour]");
      const picked: Selection | null = hit
        ? {
            contour: Number(hit.dataset.contour),
            command: hit.hasAttribute("data-command")
              ? Number(hit.dataset.command)
              : null,
            pair: hit.hasAttribute("data-pair")
              ? Number(hit.dataset.pair)
              : null,
          }
        : null;
      setSelection(picked);
      if (!picked || !outline) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      onGesture(true);
      drag.current = {
        type: "point",
        pointer: e.pointerId,
        start: position(e),
        previous: clone(model),
        source: clone(outline),
        selection: picked,
      };
      return;
    }
    const start = position(e, false);
    if (start[0] < 0 || start[0] > 1000 || start[1] < 0 || start[1] > 1000)
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onGesture(true);
    drag.current = {
      type: "stroke",
      pointer: e.pointerId,
      start: position(e),
      previous: clone(model),
    };
    publish({
      ...model,
      operations: [
        ...model.operations,
        {
          kind: tool as StrokeKind,
          width: brush,
          brushShape,
          points: [position(e)],
        },
      ],
    });
  }
  function pointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (touches.current.has(e.pointerId))
      touches.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()],
        rect = svg.current!.getBoundingClientRect(),
        start = pinch.current;
      const zoom = clamp(
        (start.zoom * Math.hypot(a[0] - b[0], a[1] - b[1])) / start.distance,
        1,
        16,
      );
      setView(
        anchoredCamera(zoom, bounds, start.anchor, [
          ((a[0] + b[0]) / 2 - rect.left) / rect.width,
          ((a[1] + b[1]) / 2 - rect.top) / rect.height,
        ]),
      );
      return;
    }
    const current = drag.current;
    if (current?.type === "pan" && current.pointer === e.pointerId) {
      const unit = canvasViewport(current.camera, bounds).unit;
      setView({
        ...current.camera,
        x: current.camera.x - (e.clientX - current.start[0]) * unit,
        y: current.camera.y - (e.clientY - current.start[1]) * unit,
      });
      return;
    }
    if (current?.type === "point" && current.pointer === e.pointerId) {
      const p = position(e);
      let dx = p[0] - current.start[0],
        dy = p[1] - current.start[1];
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      publish({
        ...current.previous,
        originalPath:
          current.previous.originalPath || current.previous.basePath,
        basePath: outlineText(
          shiftedOutline(current.source, current.selection, dx, dy),
        ),
      });
      return;
    }
    const hover = position(e, false);
    setCursor(
      ["erase", "draw", "line"].includes(tool) &&
        !spaceHeld.current &&
        e.pointerType !== "touch" &&
        hover.every((n) => n >= 0 && n <= 1000)
        ? position(e)
        : null,
    );
    if (
      !current ||
      e.pointerId !== current.pointer ||
      current.type !== "stroke"
    )
      return;
    const next = clone(liveModel.current),
      op = next.operations.at(-1)!,
      start = op.points[0];
    let p = position(e);
    if (op.kind === "line" && e.shiftKey) {
      const dx = p[0] - start[0],
        dy = p[1] - start[1],
        angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
        length = Math.hypot(dx, dy);
      p = [
        round(clamp(start[0] + Math.cos(angle) * length, 0, 1000)),
        round(clamp(start[1] + Math.sin(angle) * length, 0, 1000)),
      ];
    }
    if (op.kind === "cut" || op.kind === "line") op.points = [start, p];
    else if (
      Math.hypot(p[0] - op.points.at(-1)![0], p[1] - op.points.at(-1)![1]) >=
      0.6
    )
      op.points.push(p);
    publish(next);
  }
  function endPointer(e: ReactPointerEvent<SVGSVGElement>, cancel: boolean) {
    touches.current.delete(e.pointerId);
    finish(e.pointerId, cancel);
    if (!touches.current.size) pinch.current = null;
  }
  const cut =
    drag.current?.type === "stroke" && tool === "cut"
      ? model.operations.at(-1)
      : undefined;
  const cutEnd = cut?.points.at(-1);
  return (
    <>
      {tool === "points" && (
        <div id="pointControls" className="precision-bar">
          <span id="pointDescription">
            {point
              ? "Point"
              : selection
                ? "Outline"
                : outline
                  ? "Select a point"
                  : "This imported outline cannot be point-edited."}
          </span>
          {(
            [
              ["X", 0],
              ["Y", 1],
            ] as const
          ).map(([name, axis]) => (
            <label key={name}>
              {name}{" "}
              <input
                id={`point${name}`}
                type="number"
                min="0"
                max="1000"
                step="0.1"
                disabled={!point || busy}
                value={point ? round(point[axis]) : ""}
                onChange={(e) => {
                  if (point && Number.isFinite(e.currentTarget.valueAsNumber)) {
                    const delta =
                      clamp(e.currentTarget.valueAsNumber, 0, 1000) -
                      point[axis];
                    nudge(axis === 0 ? delta : 0, axis === 1 ? delta : 0);
                  }
                }}
              />
            </label>
          ))}
          <button
            id="removeContour"
            disabled={!selection || busy}
            onClick={() => {
              if (!selection || !outline) return;
              if (outline.length === 1) {
                notify(
                  "Use erase or cut to remove the last remaining outline.",
                  true,
                );
                return;
              }
              onCommit(model);
              publish({
                ...model,
                originalPath: model.originalPath || model.basePath,
                basePath: outlineText(
                  outline.filter((_, i) => i !== selection.contour),
                ),
              });
              setSelection(null);
            }}
          >
            Remove outline
          </button>
        </div>
      )}
      <div className="canvas-surround">
        <div id="canvasFrame" className="canvas-frame">
          <svg
            ref={svg}
            id="canvas"
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Kanji drawing canvas. Drag to edit the character."
            tabIndex={0}
            data-mode={tool}
            className={`${space ? "space-pan" : ""} ${panning ? "is-panning" : ""}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={(e) => endPointer(e, false)}
            onPointerCancel={(e) => endPointer(e, true)}
            onLostPointerCapture={(e) => finish(e.pointerId, true)}
            onPointerLeave={() => setCursor(null)}
          >
            <defs>
              <pattern
                id="checks"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <rect width="40" height="40" fill="#fff" />
                <path d="M0 0H20V20H0ZM20 20H40V40H20Z" fill="#f3f4f3" />
              </pattern>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={view.width}
              height={view.height}
              fill="#edf1eb"
            />
            <rect
              id="printBounds"
              width="1000"
              height="1000"
              fill="url(#checks)"
              stroke="#a7b5aa"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            >
              <title>Printable character area</title>
            </rect>
            {guides && (
              <g id="grid" pointerEvents="none">
                <path d="M500 0V1000M0 500H1000" />
                <path
                  d="M250 0V1000M750 0V1000M0 250H1000M0 750H1000"
                  className="grid-minor"
                />
              </g>
            )}
            <g id="artwork">
              <Glyph model={model} prefix="edit" unbounded viewport={view} />
            </g>
            {tool === "points" && outline && (
              <OutlineOverlay
                data={outline}
                selection={selection}
                unit={unit}
              />
            )}
            {cut && cutEnd && cut.points.length > 1 && (
              <rect
                id="cutPreview"
                pointerEvents="none"
                x={Math.min(cut.points[0][0], cutEnd[0])}
                y={Math.min(cut.points[0][1], cutEnd[1])}
                width={Math.abs(cutEnd[0] - cut.points[0][0])}
                height={Math.abs(cutEnd[1] - cut.points[0][1])}
              />
            )}
            <g id="pointerOverlay" pointerEvents="none">
              {cursor &&
                (brushShape === "square" ? (
                  <rect
                    id="brushCursor"
                    x={cursor[0] - brush / 2}
                    y={cursor[1] - brush / 2}
                    width={brush}
                    height={brush}
                  />
                ) : (
                  <circle
                    id="brushCursor"
                    cx={cursor[0]}
                    cy={cursor[1]}
                    r={brush / 2}
                  />
                ))}
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
