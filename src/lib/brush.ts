import type { Point } from "../types";
import { pathFor } from "./geometry";

/** Sweep an axis-aligned square nib along each segment, including its corners. */
export function squareBrushPath(
  points: Point[],
  width: number,
  straight = false,
): string {
  if (!points.length) return "";
  const half = width / 2,
    use = straight ? [points[0], points[points.length - 1]] : points;
  const corners = ([x, y]: Point): Point[] => [
    [x - half, y - half],
    [x + half, y - half],
    [x + half, y + half],
    [x - half, y + half],
  ];
  const hull = (points: Point[]): Point[] => {
    const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a: Point, b: Point, c: Point) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const halfHull = (list: Point[]) => {
      const result: Point[] = [];
      for (const point of list) {
        while (
          result.length >= 2 &&
          cross(result[result.length - 2], result[result.length - 1], point) <=
            0
        )
          result.pop();
        result.push(point);
      }
      return result.slice(0, -1);
    };
    return [...halfHull(sorted), ...halfHull([...sorted].reverse())];
  };
  if (use.length === 1) return pathFor(corners(use[0])) + "Z";
  return use
    .slice(1)
    .map(
      (point, i) =>
        pathFor(hull([...corners(use[i]), ...corners(point)])) + "Z",
    )
    .join("");
}
