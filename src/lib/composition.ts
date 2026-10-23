import { clamp, outlineText, parseOutline, round } from "./geometry";
import type { Point } from "../types";

export type Rect = { x: number; y: number; width: number; height: number };
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export interface ComponentPart extends Rect {
  id: string;
  kind: "radical" | "stroke";
  label: string;
  path: string;
  crop: Rect;
  fontLabel?: string;
  customFont?: boolean;
}
export interface Composition {
  format: "kanji-maker-composition";
  version: 1;
  name: string;
  parts: ComponentPart[];
  libraryId?: string;
}
export const COMPOSITION_DRAFT = "kanji-maker.composition.v1";
export const emptyComposition = (): Composition => ({
  format: "kanji-maker-composition",
  version: 1,
  name: "Radical composition",
  parts: [],
});

export function createPart(
  source: Pick<
    ComponentPart,
    "kind" | "label" | "path" | "fontLabel" | "customFont"
  >,
  id: string,
  offset = 0,
): ComponentPart {
  const outline = parseOutline(source.path);
  if (!outline?.length) throw Error("This component has no usable outline.");
  const xs = outline.flatMap((c) =>
    c.flatMap((p) => p.values.filter((_, i) => i % 2 === 0)),
  );
  const ys = outline.flatMap((c) =>
    c.flatMap((p) => p.values.filter((_, i) => i % 2 === 1)),
  );
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const sourceWidth = Math.max(...xs) - left,
    sourceHeight = Math.max(...ys) - top;
  if (!(sourceWidth > 0 && sourceHeight > 0))
    throw Error("This component has no visible area.");
  const scale = 600 / Math.max(sourceWidth, sourceHeight);
  const width = sourceWidth * scale,
    height = sourceHeight * scale;
  const path = outlineText(
    outline.map((c) =>
      c.map((p) => ({
        ...p,
        values: p.values.map(
          (n, i) =>
            ((n - (i % 2 ? top : left)) * 1000) /
            (i % 2 ? sourceHeight : sourceWidth),
        ),
      })),
    ),
  );
  return {
    ...source,
    customFont: source.customFont === true,
    id,
    path,
    x: round(500 - width / 2 + offset),
    y: round(500 - height / 2 + offset),
    width: Math.max(1, round(width)),
    height: Math.max(1, round(height)),
    crop: { x: 0, y: 0, width: 1000, height: 1000 },
  };
}
export function partBounds(part: ComponentPart): Rect {
  return {
    x: part.x + (part.crop.x * part.width) / 1000,
    y: part.y + (part.crop.y * part.height) / 1000,
    width: (part.width * part.crop.width) / 1000,
    height: (part.height * part.crop.height) / 1000,
  };
}
/** Resize the visible, cropped component without changing which source area it contains. */
export function resizePart(part: ComponentPart, target: Rect): ComponentPart {
  const width = (target.width * 1000) / part.crop.width,
    height = (target.height * 1000) / part.crop.height;
  return {
    ...part,
    x: round(target.x - (part.crop.x * width) / 1000),
    y: round(target.y - (part.crop.y * height) / 1000),
    width: round(width),
    height: round(height),
  };
}
export function resizeRect(
  rect: Rect,
  handle: Handle,
  point: Point,
  minSize = 10,
  source = false,
): Rect {
  let left = rect.x,
    top = rect.y,
    right = left + rect.width,
    bottom = top + rect.height;
  if (handle.includes("w"))
    left = clamp(point[0], source ? 0 : -5000, right - minSize);
  if (handle.includes("e"))
    right = clamp(point[0], left + minSize, source ? 1000 : 5000);
  if (handle.includes("n"))
    top = clamp(point[1], source ? 0 : -5000, bottom - minSize);
  if (handle.includes("s"))
    bottom = clamp(point[1], top + minSize, source ? 1000 : 5000);
  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top),
  };
}
export function cropPart(
  part: ComponentPart,
  handle: Handle,
  point: Point,
): ComponentPart {
  const source: Point = [
    ((point[0] - part.x) * 1000) / part.width,
    ((point[1] - part.y) * 1000) / part.height,
  ];
  return { ...part, crop: resizeRect(part.crop, handle, source, 10, true) };
}
export const isCropped = (part: ComponentPart) =>
  part.crop.x !== 0 ||
  part.crop.y !== 0 ||
  part.crop.width !== 1000 ||
  part.crop.height !== 1000;
/** Overlapping components must be merged as ink, regardless of source winding. */
export function compositionNeedsTracing(parts: ComponentPart[]) {
  if (parts.some(isCropped)) return true;
  return parts.some((part, i) => {
    const a = partBounds(part);
    return parts.slice(i + 1).some((other) => {
      const b = partBounds(other);
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    });
  });
}
export function transformedPath(part: ComponentPart) {
  const outline = parseOutline(part.path)!;
  return outlineText(
    outline.map((c) =>
      c.map((p) => ({
        ...p,
        values: p.values.map((n, i) =>
          i % 2
            ? part.y + (n * part.height) / 1000
            : part.x + (n * part.width) / 1000,
        ),
      })),
    ),
  );
}
export function parseComposition(value: unknown): Composition {
  if (!value || typeof value !== "object")
    throw Error("Choose a radical composition file.");
  const data = value as Partial<Composition>;
  if (
    data.format !== "kanji-maker-composition" ||
    data.version !== 1 ||
    typeof data.name !== "string" ||
    data.name.length > 80 ||
    !Array.isArray(data.parts) ||
    data.parts.length > 100
  )
    throw Error("Invalid radical composition file.");
  const ids = new Set<string>();
  const finite = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const parts = data.parts.map((part): ComponentPart => {
    if (
      !part ||
      typeof part !== "object" ||
      typeof part.id !== "string" ||
      !/^[\w-]{1,80}$/.test(part.id) ||
      ids.has(part.id) ||
      !["radical", "stroke"].includes(part.kind) ||
      typeof part.label !== "string" ||
      part.label.length > 80 ||
      typeof part.path !== "string" ||
      part.path.length > 200000 ||
      !parseOutline(part.path)?.length ||
      !finite(part.x, -1000000, 1000000) ||
      !finite(part.y, -1000000, 1000000) ||
      !finite(part.width, 1, 1000000) ||
      !finite(part.height, 1, 1000000)
    )
      throw Error("A component in this file is invalid.");
    const c = part.crop;
    if (
      !c ||
      !finite(c.x, 0, 990) ||
      !finite(c.y, 0, 990) ||
      !finite(c.width, 10, 1000) ||
      !finite(c.height, 10, 1000) ||
      c.x + c.width > 1000.001 ||
      c.y + c.height > 1000.001
    )
      throw Error("A crop in this file is invalid.");
    ids.add(part.id);
    return {
      id: part.id,
      kind: part.kind,
      label: part.label,
      path: part.path,
      x: part.x,
      y: part.y,
      width: part.width,
      height: part.height,
      crop: { ...c },
      fontLabel:
        typeof part.fontLabel === "string"
          ? part.fontLabel.slice(0, 200)
          : undefined,
      customFont: part.customFont === true,
    };
  });
  return {
    format: "kanji-maker-composition",
    version: 1,
    name: data.name,
    parts,
    ...(typeof data.libraryId === "string" &&
    /^[a-z0-9-]{1,80}$/i.test(data.libraryId)
      ? { libraryId: data.libraryId }
      : {}),
  };
}
