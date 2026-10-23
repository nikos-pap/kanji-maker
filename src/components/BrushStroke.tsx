import type { Operation } from "../types";
import { pathFor } from "../lib/geometry";
import { squareBrushPath } from "../lib/brush";

/** Shared by the drawing and erasing layers, and by every export format. */
export function BrushStroke({ operation: op }: { operation: Operation }) {
  if (op.brushShape === "square")
    return (
      <path
        d={squareBrushPath(op.points, op.width, op.kind === "line")}
        fill="#000"
      />
    );
  return (
    <path
      d={pathFor(op.points, op.kind === "line")}
      fill="none"
      stroke="#000"
      strokeWidth={op.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
