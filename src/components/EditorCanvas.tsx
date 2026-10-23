import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
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
  busy: boolean;
  onChange: (model: GlyphModel) => void;
  onCommit: (previous: GlyphModel) => void;
  onPending: (pending: boolean) => void;
  onGesture: (active: boolean) => void;
  notify: (message: string, error?: boolean) => void;
};
export const hints: Record<Tool, string> = {
  points:
    "Squares are outline points; circles are curve handles. Drag, enter X/Y, or nudge with arrows (Shift: 10, Alt: 0.1).",
  erase: "Drag to erase. The checkerboard shows transparent areas.",
  cut: "Drag a rectangle around the part you want to remove.",
  polygon:
    "Click corners, then Apply cut or Enter. Click the first corner to close; Escape cancels.",
  draw: "Drag to add a stroke. Reduce Size for finer details.",
  line: "Drag to add a straight stroke. Hold Shift to snap its angle.",
  pan: "Drag to move around the character. Scroll to zoom; Fit shows the whole character.",
};

function OutlineOverlay({
  data,
  selection,
  unit,
}: {
  data: Outline;
  selection: Selection | null;
  unit: number;
}) {
  const handles = data.flatMap((contour, ci) =>
    contour.flatMap((p, pi) => {
      if (!p.values.length) return [];
      const pair = p.values.length / 2 - 1,
        [x, y] = p.values.slice(-2);
      const active =
        selection?.contour === ci &&
        selection.command === pi &&
        selection.pair === pair;
      return [
        <rect
          key={`${ci}-${pi}`}
          x={x - 3.5 * unit}
          y={y - 3.5 * unit}
          width={7 * unit}
          height={7 * unit}
          className={`anchor${active ? " active-point" : ""}`}
          data-contour={ci}
          data-command={pi}
          data-pair={pair}
        >
          <title>
            Outline point: {round(x)}, {round(y)}
          </title>
        </rect>,
      ];
    }),
  );
  return (
    <g id="outlineOverlay">
      {data.map((c, ci) => (
        <path
          key={ci}
          d={outlineText([c])}
          className={`outline-hit${selection?.contour === ci ? " selected" : ""}`}
          data-contour={ci}
        />
      ))}
      {selection &&
        data[selection.contour]?.flatMap((p, pi, contour) => {
          const previous = contour[pi - 1]?.values.slice(-2),
            end = p.values.slice(-2);
          if (
            !["Q", "C"].includes(p.cmd) ||
            !previous ||
            (selection.command !== pi && selection.command !== pi - 1)
          )
            return [];
          return Array.from({ length: p.values.length / 2 - 1 }, (_, pair) => {
            const [x, y] = p.values.slice(pair * 2, pair * 2 + 2),
              root = p.cmd === "C" && pair === 1 ? end : previous;
            return (
              <g key={`${pi}-${pair}`}>
                <path
                  d={`M${root[0]} ${root[1]}L${x} ${y}`}
                  className="handle-line"
                />
                {p.cmd === "Q" && (
                  <path
                    d={`M${end[0]} ${end[1]}L${x} ${y}`}
                    className="handle-line"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={4 * unit}
                  className={`control-point${selection.command === pi && selection.pair === pair ? " active-point" : ""}`}
                  data-contour={selection.contour}
                  data-command={pi}
                  data-pair={pair}
                />
              </g>
            );
          });
        })}
      {handles}
    </g>
  );
}

export function EditorCanvas(props: Props) {
  const {
    model,
    tool,
    brush,
    busy,
    onChange,
    onCommit,
    onPending,
    onGesture,
    notify,
  } = props;
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null),
    liveModel = useRef(model);
  liveModel.current = model;
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selection, setSelection] = useState<Selection | null>(null),
    [polygon, setPolygon] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null),
    [cursor, setCursor] = useState<Point | null>(null);
  const [space, setSpace] = useState(false),
    [panning, setPanning] = useState(false),
    [guides, setGuides] = useState(true);
  const [width, setWidth] = useState(620);
  const spaceHeld = useRef(false),
    touches = useRef(new Map<number, Point>());
  const pinch = useRef<{
    zoom: number;
    distance: number;
    anchor: Point;
  } | null>(null);
  const outline = useMemo(() => parseOutline(model.basePath), [model.basePath]),
    point = activePoint(outline, selection);
  const unit = 1000 / (camera.zoom * width),
    size = 1000 / camera.zoom;
  const publish = (next: GlyphModel) => {
    liveModel.current = next;
    onChange(next);
  };
  const setView = useCallback((next: Camera) => {
    const size = 1000 / next.zoom;
    setCamera({
      ...next,
      x: clamp(next.x, 0, 1000 - size),
      y: clamp(next.y, 0, 1000 - size),
    });
    setCursor(null);
  }, []);
  function zoomTo(value: number, anchor?: Point) {
    if (drag.current) return;
    const zoom = clamp(value, 1, 16),
      focus = anchor ||
        (tool === "points" && point) || [
          camera.x + 500 / camera.zoom,
          camera.y + 500 / camera.zoom,
        ];
    const ratio = camera.zoom / zoom;
    setView({
      zoom,
      x: focus[0] - (focus[0] - camera.x) * ratio,
      y: focus[1] - (focus[1] - camera.y) * ratio,
    });
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
  function finishPolygon() {
    if (polygon.length < 3 || busy) return;
    const area = polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    if (Math.abs(area) < 0.1) {
      notify("Choose corners that enclose an area.", true);
      return;
    }
    onCommit(model);
    publish({
      ...model,
      operations: [
        ...model.operations,
        { kind: "polygon", width: 1, points: clone(polygon) },
      ],
    });
    setPolygon([]);
    setHover(null);
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
    setPolygon([]);
    setHover(null);
    setCursor(null);
  }, [tool]);
  useEffect(() => {
    onPending(!!polygon.length);
  }, [polygon.length, onPending]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width || 620),
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
      if (e.key === "Escape") {
        if (drag.current) finish(drag.current.pointer, true);
        else {
          setPolygon([]);
          setHover(null);
        }
      }
      if (drag.current) return;
      if (e.key === "Enter" && tool === "polygon") {
        e.preventDefault();
        finishPolygon();
      }
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
    if (tool === "pan" || spaceHeld.current || e.button === 1) {
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
    if (tool === "polygon") {
      const p = position(e),
        threshold = 7 * unit;
      if (
        polygon.length >= 3 &&
        Math.hypot(p[0] - polygon[0][0], p[1] - polygon[0][1]) < threshold
      ) {
        finishPolygon();
        return;
      }
      if (
        !polygon.length ||
        Math.hypot(p[0] - polygon.at(-1)![0], p[1] - polygon.at(-1)![1]) >
          threshold
      )
        setPolygon([...polygon, p]);
      setHover(null);
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
        { kind: tool as StrokeKind, width: brush, points: [position(e)] },
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
        ),
        size = 1000 / zoom;
      setView({
        zoom,
        x:
          start.anchor[0] -
          (((a[0] + b[0]) / 2 - rect.left) / rect.width) * size,
        y:
          start.anchor[1] -
          (((a[1] + b[1]) / 2 - rect.top) / rect.height) * size,
      });
      return;
    }
    const current = drag.current;
    if (tool === "polygon" && polygon.length) setHover(position(e));
    if (current?.type === "pan" && current.pointer === e.pointerId) {
      const unit = 1000 / (current.camera.zoom * width);
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
    setCursor(
      ["erase", "draw", "line"].includes(tool) &&
        !spaceHeld.current &&
        e.pointerType !== "touch"
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
  const zooms = [...new Set([1, 1.5, 2, 3, 4, 8, 16, camera.zoom])].sort(
    (a, b) => a - b,
  );
  const edited = model.originalPath && model.basePath !== model.originalPath;
  return (
    <>
      {tool === "points" && (
        <div id="pointControls" className="precision-bar">
          <span id="pointDescription">
            {point
              ? "Outline point · arrows to nudge"
              : selection
                ? "Drag the highlighted outline to move it."
                : outline
                  ? "Select an outline or a square point."
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
      {tool === "polygon" && (
        <div id="polygonControls" className="precision-bar">
          <span>Click corners around the area to remove.</span>
          <button
            id="applyPolygon"
            className="primary"
            disabled={polygon.length < 3 || busy}
            onClick={finishPolygon}
          >
            Apply cut
          </button>
          <button
            id="cancelPolygon"
            disabled={!polygon.length}
            onClick={() => {
              setPolygon([]);
              setHover(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <div className="view-toolbar" aria-label="Canvas view controls">
        <span>Scroll to zoom · Space + drag to pan</span>
        <div className="zoom-controls">
          <button
            id="zoomOut"
            aria-label="Zoom out"
            disabled={camera.zoom <= 1}
            onClick={() => zoomTo(camera.zoom / 1.5)}
          >
            −
          </button>
          <select
            id="zoomLevel"
            aria-label="Canvas zoom"
            value={camera.zoom}
            onChange={(e) => zoomTo(Number(e.currentTarget.value))}
          >
            {zooms.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          <button
            id="zoomIn"
            aria-label="Zoom in"
            disabled={camera.zoom >= 16}
            onClick={() => zoomTo(camera.zoom * 1.5)}
          >
            +
          </button>
          <button id="zoomFit" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>
            Fit
          </button>
        </div>
      </div>
      <div className="canvas-surround">
        <div id="canvasFrame" className="canvas-frame">
          <svg
            ref={svg}
            id="canvas"
            viewBox={`${camera.x} ${camera.y} ${size} ${size}`}
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
            onDoubleClick={(e) => {
              if (tool === "polygon") {
                e.preventDefault();
                finishPolygon();
              }
            }}
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
            <rect width="1000" height="1000" fill="url(#checks)" />
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
              <Glyph model={model} prefix="edit" />
            </g>
            {tool === "points" && outline && (
              <OutlineOverlay
                data={outline}
                selection={selection}
                unit={unit}
              />
            )}
            <g id="polygonOverlay" pointerEvents="none">
              {!!polygon.length && (
                <>
                  <polygon
                    points={(hover ? [...polygon, hover] : polygon)
                      .map((p) => p.join(","))
                      .join(" ")}
                  />
                  {polygon.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={4 * unit} />
                  ))}
                </>
              )}
            </g>
            <g id="pointerOverlay" pointerEvents="none">
              {cursor && (
                <circle
                  id="brushCursor"
                  cx={cursor[0]}
                  cy={cursor[1]}
                  r={brush / 2}
                />
              )}
            </g>
          </svg>
        </div>
      </div>
      <footer className="canvas-footer">
        <p id="toolHint">{hints[tool]}</p>
        <label>
          <input
            id="showGrid"
            type="checkbox"
            checked={guides}
            onChange={(e) => setGuides(e.currentTarget.checked)}
          />{" "}
          Guides
        </label>
        <span id="editCount">
          {[
            model.operations.length ? `${model.operations.length} edits` : "",
            edited ? "Outline edited" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "Original character"}
        </span>
      </footer>
    </>
  );
}
