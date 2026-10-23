import type { FontPoint, Point } from "../types";

export function traceContours(canvas: HTMLCanvasElement): FontPoint[][] {
  const size = canvas.width,
    pixels = canvas.getContext("2d")!.getImageData(0, 0, size, size).data;
  const black = new Uint8Array(size * size);
  let filled = 0;
  for (let i = 0; i < black.length; i++) {
    black[i] = pixels[i * 4 + 3] >= 128 ? 1 : 0;
    filled += black[i];
  }
  if (!filled)
    throw Error(
      "The character is empty. Undo an erase or draw a stroke first.",
    );
  const stride = size + 1,
    edges = new Map<number, number[]>();
  function edge(a: number, b: number) {
    const out = edges.get(a);
    if (out) out.push(b);
    else edges.set(a, [b]);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!black[i]) continue;
      const a = y * stride + x;
      if (!y || !black[i - size]) edge(a, a + 1);
      if (x === size - 1 || !black[i + 1]) edge(a + 1, a + stride + 1);
      if (y === size - 1 || !black[i + size]) edge(a + stride + 1, a + stride);
      if (!x || !black[i - 1]) edge(a + stride, a);
    }
  function simplify(points: Point[]) {
    // Ramer–Douglas–Peucker on the two halves of a closed contour.
    let far = 1,
      distance = 0;
    for (let i = 1; i < points.length; i++) {
      const d =
        (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
      if (d > distance) {
        distance = d;
        far = i;
      }
    }
    function open(list: Point[]) {
      const keep = new Set([0, list.length - 1]),
        stack = [[0, list.length - 1]];
      while (stack.length) {
        const [a, b] = stack.pop()!,
          p = list[a],
          q = list[b],
          dx = q[0] - p[0],
          dy = q[1] - p[1],
          denominator = dx * dx + dy * dy;
        let max = 0.6 * 0.6,
          index = -1;
        for (let i = a + 1; i < b; i++) {
          const t = denominator
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((list[i][0] - p[0]) * dx + (list[i][1] - p[1]) * dy) /
                    denominator,
                ),
              )
            : 0;
          const d =
            (list[i][0] - p[0] - t * dx) ** 2 +
            (list[i][1] - p[1] - t * dy) ** 2;
          if (d > max) {
            max = d;
            index = i;
          }
        }
        if (index >= 0) {
          keep.add(index);
          stack.push([a, index], [index, b]);
        }
      }
      return [...keep].sort((a, b) => a - b).map((i) => list[i]);
    }
    return [
      ...open(points.slice(0, far + 1)).slice(0, -1),
      ...open([...points.slice(far), points[0]]).slice(0, -1),
    ];
  }
  const contours: FontPoint[][] = [];
  while (edges.size) {
    const start = edges.keys().next().value!;
    let v = start;
    const points: Point[] = [];
    do {
      points.push([v % stride, Math.floor(v / stride)]);
      const out = edges.get(v);
      if (!out?.length) throw Error("Could not close an outline contour.");
      const next = out.pop()!;
      if (!out.length) edges.delete(v);
      v = next;
    } while (v !== start);
    if (points.length < 4) continue;
    const reduced = simplify(points)
      .map(([x, y]): FontPoint => [x, size - y])
      .reverse();
    if (reduced.length >= 3) contours.push(reduced);
  }
  if (!contours.length) throw Error("The character has no visible outline.");
  if (
    contours.reduce((n, c) => n + c.length, 0) > 32000 ||
    contours.length > 2000
  )
    throw Error(
      "Too much detail for one font glyph. Export SVG instead or simplify the edits.",
    );
  return contours;
}
