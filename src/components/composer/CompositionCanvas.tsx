import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Composer } from "../../hooks/useComposition";
import { clamp } from "../../lib/geometry";
import {
  cropPart,
  partBounds,
  resizePart,
  resizeRect,
} from "../../lib/composition";
import type { ComponentPart, Handle } from "../../lib/composition";
import { canvasViewport } from "../../lib/viewport";
import { CompositionArtwork, partTransform } from "./CompositionArtwork";
import type { Point } from "../../types";

type Props = { composer: Composer; crop: boolean; guides: boolean };
type Drag = {
  id: number;
  start: Point;
  part: ComponentPart;
  handle?: Handle;
  crop: boolean;
};
const handles: [Handle, number, number][] = [
  ["nw", 0, 0],
  ["n", 0.5, 0],
  ["ne", 1, 0],
  ["e", 1, 0.5],
  ["se", 1, 1],
  ["s", 0.5, 1],
  ["sw", 0, 1],
  ["w", 0, 0.5],
];
export function CompositionCanvas({ composer: c, crop, guides }: Props) {
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 620, height: 620 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.max(48, entry.contentRect.width),
        height: Math.max(48, entry.contentRect.height),
      }),
    );
    observer.observe(svg.current!);
    return () => observer.disconnect();
  }, []);
  const view = canvasViewport(
    { x: 0, y: 0, zoom: 1 },
    {
      ...size,
      fit: { x: 14, y: 14, width: size.width - 28, height: size.height - 28 },
    },
  );
  const bounds = c.part ? partBounds(c.part) : null;
  function point(event: { clientX: number; clientY: number }): Point {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return [p.x, p.y];
  }
  function finish(cancel = false) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    c.end(cancel);
    if (svg.current?.hasPointerCapture(current.id))
      svg.current.releasePointerCapture(current.id);
  }
  useEffect(() => {
    const blur = () => finish(true);
    addEventListener("blur", blur);
    return () => removeEventListener("blur", blur);
  });
  function down(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    const target = event.target as Element;
    const handle = target.closest<SVGElement>("[data-handle]")?.dataset
      .handle as Handle | undefined;
    const id = handle
      ? c.selected
      : target.closest<SVGElement>("[data-component]")?.dataset.component;
    const part = c.document.parts.find((p) => p.id === id);
    if (!part) {
      c.select(null);
      return;
    }
    c.select(part.id);
    c.begin();
    drag.current = {
      id: event.pointerId,
      start: point(event),
      part: structuredClone(part),
      handle,
      crop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    event.preventDefault();
    const p = point(event),
      start = current.part;
    const original = partBounds(start);
    const handlePoint: Point = [
      (current.handle?.includes("w")
        ? original.x
        : original.x + original.width) +
        p[0] -
        current.start[0],
      (current.handle?.includes("n")
        ? original.y
        : original.y + original.height) +
        p[1] -
        current.start[1],
    ];
    let next: ComponentPart;
    if (current.handle && current.crop)
      next = cropPart(start, current.handle, handlePoint);
    else if (current.handle) {
      let target = resizeRect(original, current.handle, handlePoint);
      if (event.shiftKey && current.handle.length === 2) {
        const scale = Math.max(
          target.width / original.width,
          target.height / original.height,
        );
        const width = original.width * scale,
          height = original.height * scale;
        target = {
          x: current.handle.includes("w")
            ? original.x + original.width - width
            : original.x,
          y: current.handle.includes("n")
            ? original.y + original.height - height
            : original.y,
          width,
          height,
        };
      }
      next = resizePart(start, target);
    } else if (current.crop) {
      next = {
        ...start,
        crop: {
          ...start.crop,
          x: clamp(
            start.crop.x + ((p[0] - current.start[0]) * 1000) / start.width,
            0,
            1000 - start.crop.width,
          ),
          y: clamp(
            start.crop.y + ((p[1] - current.start[1]) * 1000) / start.height,
            0,
            1000 - start.crop.height,
          ),
        },
      };
    } else {
      let dx = p[0] - current.start[0],
        dy = p[1] - current.start[1];
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      next = {
        ...start,
        x: clamp(start.x + dx, -5000, 5000),
        y: clamp(start.y + dy, -5000, 5000),
      };
    }
    c.updatePart(next, true);
  }
  return (
    <svg
      ref={svg}
      id="compositionCanvas"
      className="composition-canvas"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label="Radical and stroke composition canvas"
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          finish(true);
          c.select(null);
          return;
        }
        if (!c.part || drag.current) return;
        if (["Delete", "Backspace"].includes(event.key)) {
          event.preventDefault();
          c.remove();
        }
        const deltas: Record<string, Point> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (event.key in deltas) {
          event.preventDefault();
          const [dx, dy] = deltas[event.key],
            step = event.shiftKey ? 10 : 1;
          c.updatePart({
            ...c.part,
            x: c.part.x + dx * step,
            y: c.part.y + dy * step,
          });
        }
      }}
    >
      <defs>
        <pattern
          id="compositionChecks"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <rect width="40" height="40" fill="#fff" />
          <path d="M0 0H20V20H0ZM20 20H40V40H20Z" fill="#f3f4f3" />
        </pattern>
      </defs>
      <rect
        id="compositionPrintBounds"
        width="1000"
        height="1000"
        fill="url(#compositionChecks)"
        stroke="#a7b5aa"
        vectorEffect="non-scaling-stroke"
      />
      {guides && (
        <path
          className="composition-guides"
          d="M500 0V1000M0 500H1000M250 0V1000M750 0V1000M0 250H1000M0 750H1000"
          pointerEvents="none"
        />
      )}
      {crop && c.part && (
        <path
          d={c.part.path}
          transform={partTransform(c.part)}
          fill="#b7c7b9"
          opacity=".55"
          pointerEvents="none"
        />
      )}
      {c.document.parts.map((part) => (
        <g key={part.id} data-component={part.id}>
          <rect {...partBounds(part)} fill="transparent" />
          <CompositionArtwork parts={[part]} prefix="composition" />
        </g>
      ))}
      {!c.document.parts.length && (
        <text
          x="500"
          y="500"
          textAnchor="middle"
          className="composition-empty"
          pointerEvents="none"
        >
          Add a radical or stroke
        </text>
      )}
      {bounds && (
        <g
          className={
            crop ? "composition-selection is-cropping" : "composition-selection"
          }
        >
          <rect {...bounds} fill="none" pointerEvents="none" />
          {handles.map(([handle, x, y]) => (
            <g
              key={handle}
              data-handle={handle}
              style={{ cursor: `${handle}-resize` }}
              transform={`translate(${bounds.x + x * bounds.width} ${bounds.y + y * bounds.height})`}
            >
              <rect
                x={-15 * view.unit}
                y={-15 * view.unit}
                width={30 * view.unit}
                height={30 * view.unit}
                fill="transparent"
                stroke="none"
              />
              <rect
                x={-4 * view.unit}
                y={-4 * view.unit}
                width={8 * view.unit}
                height={8 * view.unit}
                fill="#fff"
              />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
