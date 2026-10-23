import type { BrushShape, Point } from "../types";

export function BrushCursor({
  point,
  size,
  shape,
}: {
  point: Point;
  size: number;
  shape: BrushShape;
}) {
  const Shape = shape === "square" ? "rect" : "circle";
  const bounds =
    shape === "square"
      ? {
          x: point[0] - size / 2,
          y: point[1] - size / 2,
          width: size,
          height: size,
        }
      : { cx: point[0], cy: point[1], r: size / 2 };
  return (
    <>
      <Shape className="brush-cursor-halo" {...bounds} />
      <Shape id="brushCursor" {...bounds} />
    </>
  );
}
