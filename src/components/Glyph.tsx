import type { GlyphModel } from "../types";
import { pathFor } from "../lib/geometry";
import { BrushStroke } from "./BrushStroke";

/** The same declarative SVG is used for editing, previews and exports. */
export function Glyph({
  model,
  prefix,
  title = false,
  unbounded = false,
  viewport,
}: {
  model: GlyphModel;
  prefix: string;
  title?: boolean;
  unbounded?: boolean;
  viewport?: { x: number; y: number; width: number; height: number };
}) {
  const maskArea =
    unbounded && viewport
      ? viewport
      : { x: 0, y: 0, width: 1000, height: 1000 };
  let shape = <path d={model.basePath} fill="#000" />;
  const masks = [];
  for (const [i, op] of model.operations.entries()) {
    if (op.kind === "erase" || op.kind === "cut" || op.kind === "polygon") {
      const id = `${prefix}-erase-${i}`,
        a = op.points[0],
        b = op.points[op.points.length - 1];
      masks.push(
        <mask
          key={id}
          id={id}
          maskUnits="userSpaceOnUse"
          x={maskArea.x}
          y={maskArea.y}
          width={maskArea.width}
          height={maskArea.height}
          style={{ maskType: "luminance" }}
        >
          <rect
            x={maskArea.x}
            y={maskArea.y}
            width={maskArea.width}
            height={maskArea.height}
            fill="#fff"
          />
          {op.kind === "cut" ? (
            <rect
              x={Math.min(a[0], b[0])}
              y={Math.min(a[1], b[1])}
              width={Math.abs(b[0] - a[0])}
              height={Math.abs(b[1] - a[1])}
              fill="#000"
            />
          ) : op.kind === "polygon" ? (
            <path d={pathFor(op.points) + "Z"} fill="#000" />
          ) : (
            <BrushStroke operation={op} />
          )}
        </mask>,
      );
      shape = <g mask={`url(#${id})`}>{shape}</g>;
    } else
      shape = (
        <g>
          {shape}
          <BrushStroke operation={op} />
        </g>
      );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width="1000"
      height="1000"
      overflow={unbounded ? "visible" : "hidden"}
    >
      {title && <title>{model.name}</title>}
      <defs>{masks}</defs>
      {shape}
    </svg>
  );
}
