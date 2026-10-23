import type { Outline, Point, Selection, SourceFont } from "../types";

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const clone = <T>(value: T): T => structuredClone(value);
export const pathFor = (points: Point[], straight = false): string => {
  if (!points.length) return "";
  const use = straight ? [points[0], points[points.length - 1]] : points;
  if (
    use.length === 1 ||
    use.every((p) => p[0] === use[0][0] && p[1] === use[0][1])
  )
    return `M${use[0][0]} ${use[0][1]}l.001 0`;
  return use.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");
};

export function parseOutline(path: string): Outline | null {
  const pattern = /[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  if (path.replace(pattern, "").trim()) return null;
  const tokens = path.match(pattern) || [],
    result: Outline = [];
  let i = 0,
    current: Outline[number] | undefined;
  const lengths: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
  while (i < tokens.length) {
    const cmd = tokens[i++],
      length = lengths[cmd];
    if (length == null || i + length > tokens.length) return null;
    const values = tokens.slice(i, i + length).map(Number);
    i += length;
    if (values.some((n) => !Number.isFinite(n))) return null;
    if (cmd === "M") {
      current = [];
      result.push(current);
    }
    if (!current) return null;
    current.push({ cmd, values });
  }
  return result;
}
export const outlineText = (data: Outline): string =>
  data
    .map((c) => c.map((p) => p.cmd + p.values.map(round).join(" ")).join(""))
    .join("");

export function activePoint(
  data: Outline | null,
  selection: Selection | null,
): Point | null {
  if (!selection || selection.command == null || selection.pair == null)
    return null;
  const command = data?.[selection.contour]?.[selection.command],
    offset = selection.pair * 2;
  return command && offset + 1 < command.values.length
    ? [command.values[offset], command.values[offset + 1]]
    : null;
}

export function shiftedOutline(
  source: Outline,
  selection: Selection,
  dx: number,
  dy: number,
): Outline {
  const data = clone(source),
    p = activePoint(data, selection),
    contour = data[selection.contour];
  if (!contour) return data;
  if (p && selection.command != null && selection.pair != null) {
    dx = clamp(dx, -p[0], 1000 - p[0]);
    dy = clamp(dy, -p[1], 1000 - p[1]);
    const command = contour[selection.command],
      offset = selection.pair * 2;
    const endpoint = offset === command.values.length - 2;
    const first = contour[0],
      last = contour.findLast((c) => c.values.length)!;
    const sameEnds =
      first.values[0] === last.values.at(-2) &&
      first.values[1] === last.values.at(-1);
    if (endpoint && sameEnds && command !== last && selection.command === 0) {
      last.values[last.values.length - 2] += dx;
      last.values[last.values.length - 1] += dy;
    } else if (endpoint && sameEnds && command === last) {
      first.values[0] += dx;
      first.values[1] += dy;
    }
    command.values[offset] += dx;
    command.values[offset + 1] += dy;
  } else {
    const xs = contour.flatMap((c) => c.values.filter((_, i) => i % 2 === 0)),
      ys = contour.flatMap((c) => c.values.filter((_, i) => i % 2));
    dx = clamp(dx, -Math.min(...xs), 1000 - Math.max(...xs));
    dy = clamp(dy, -Math.min(...ys), 1000 - Math.max(...ys));
    contour.forEach((c) => {
      c.values = c.values.map((v, i) => round(v + (i % 2 ? dy : dx)));
    });
  }
  return data;
}

export function glyphPath(face: SourceFont, character: string): string {
  const code = character.codePointAt(0)!;
  if (!face.hasGlyphForCodePoint(code))
    throw Error(
      "This font does not contain that character. Choose another font.",
    );
  const glyph = face.glyphForCodePoint(code),
    scale = 840 / face.unitsPerEm,
    x = (1000 - glyph.advanceWidth * scale) / 2;
  const commands: Record<string, string> = {
    moveTo: "M",
    lineTo: "L",
    quadraticCurveTo: "Q",
    bezierCurveTo: "C",
    closePath: "Z",
  };
  return glyph.path.commands
    .map((c) => {
      if (!(c.command in commands)) throw Error("Unsupported outline command.");
      return (
        commands[c.command] +
        c.args
          .map((n, i) => round(i % 2 ? 800 - n * scale : x + n * scale))
          .join(" ")
      );
    })
    .join("");
}
