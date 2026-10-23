import type {
  GlyphModel,
  LibraryEntry,
  LibraryFile,
  LibraryMeta,
  Operation,
  StrokeKind,
} from "../types";
import { clone } from "./geometry";
import { parseComposition } from "./composition";
import type { Composition } from "./composition";

export const STORAGE = "kanji-maker.library.v1",
  DRAFT = "kanji-maker.draft.v1",
  META = "kanji-maker.library-metadata.v1";
export const newMeta = (): LibraryMeta => ({
  id: crypto.randomUUID(),
  nextCodePoint: 0xe000,
  revision: 1,
});
export const validCode = (code: unknown): code is number =>
  typeof code === "number" &&
  Number.isInteger(code) &&
  code >= 0xe000 &&
  code <= 0xf8ff;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid app file.");
  return value as Record<string, unknown>;
};
const validPath = (path: unknown): path is string =>
  typeof path === "string" &&
  !!path &&
  path.length <= 1000000 &&
  /^[MmLlHhVvCcSsQqTtAaZz0-9+.,eE\s-]+$/.test(path);
export function validModel(value: unknown): GlyphModel {
  const data = record(value);
  if (data.version !== 1 || !validPath(data.basePath))
    throw Error("Invalid character outline.");
  if (!Array.isArray(data.operations) || data.operations.length > 1000)
    throw Error("Invalid editing history.");
  const operations: Operation[] = data.operations.map((value) => {
    const op = record(value);
    if (
      !["erase", "cut", "polygon", "draw", "line"].includes(String(op.kind)) ||
      typeof op.width !== "number" ||
      !Number.isFinite(op.width) ||
      op.width < 1 ||
      op.width > 500 ||
      !Array.isArray(op.points) ||
      !op.points.length ||
      op.points.length > 50000
    )
      throw Error("Invalid stroke.");
    if (op.kind === "polygon" && op.points.length < 3)
      throw Error("A polygon needs at least three corners.");
    if (
      op.brushShape !== undefined &&
      op.brushShape !== "round" &&
      op.brushShape !== "square"
    )
      throw Error("Invalid brush shape.");
    for (const p of op.points)
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some(
          (n) =>
            typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1000,
        )
      )
        throw Error("Invalid stroke coordinates.");
    return {
      kind: op.kind as StrokeKind,
      width: op.width,
      points: clone(op.points),
      ...(op.brushShape !== undefined ? { brushShape: op.brushShape } : {}),
    };
  });
  const originalPath = data.originalPath ?? data.basePath;
  if (!validPath(originalPath)) throw Error("Invalid original outline.");
  return {
    version: 1,
    character: String(data.character || "").slice(0, 8),
    name: String(data.name || "Custom kanji").slice(0, 80),
    basePath: data.basePath,
    originalPath,
    operations,
    fontLabel: String(data.fontLabel || "").slice(0, 160),
    customFont: !!data.customFont,
  };
}
export function validMeta(value: unknown): LibraryMeta | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<LibraryMeta>;
  if (typeof data.id !== "string" || !/^[a-f0-9-]{16,64}$/i.test(data.id))
    return null;
  return {
    id: data.id,
    nextCodePoint:
      Number.isInteger(data.nextCodePoint) &&
      data.nextCodePoint! >= 0xe000 &&
      data.nextCodePoint! <= 0xf900
        ? data.nextCodePoint!
        : 0xe000,
    revision:
      Number.isInteger(data.revision) && data.revision! > 0
        ? data.revision!
        : 1,
  };
}
export function allocateCode(meta: LibraryMeta): number {
  if (meta.nextCodePoint > 0xf8ff)
    throw Error("This library has used all its private character codes.");
  return meta.nextCodePoint++;
}
export function normalizeEntries(
  value: unknown,
  meta: LibraryMeta,
  preserveCodes: boolean,
): LibraryEntry[] {
  if (!Array.isArray(value) || value.length > 2000)
    throw Error("Invalid character library.");
  const used = new Set<number>(),
    ids = new Set<string>();
  if (preserveCodes)
    meta.nextCodePoint = Math.max(
      meta.nextCodePoint,
      ...value.map((g) => (validCode(g?.codePoint) ? g.codePoint + 1 : 0)),
    );
  return value.map((value) => {
    const g = record(value),
      model = validModel(g.model);
    const id =
      preserveCodes &&
      typeof g.id === "string" &&
      /^[a-z0-9-]{1,80}$/i.test(g.id) &&
      !ids.has(g.id)
        ? g.id
        : crypto.randomUUID();
    ids.add(id);
    const codePoint =
      preserveCodes && validCode(g.codePoint) && !used.has(g.codePoint)
        ? g.codePoint
        : allocateCode(meta);
    used.add(codePoint);
    return {
      id,
      codePoint,
      model,
      ...(g.composition
        ? { composition: { ...parseComposition(g.composition), libraryId: id } }
        : {}),
    };
  });
}
export function importLibrary(
  value: unknown,
  library: LibraryEntry[],
  currentMeta: LibraryMeta,
) {
  const data = record(value);
  if (
    data.format !== "kanji-maker-library" ||
    ![1, 2].includes(Number(data.version))
  )
    throw Error("Choose a Kanji Maker library app file.");
  const restoredMeta =
    !library.length && data.version === 2 ? validMeta(data.font) : null;
  const meta = clone(restoredMeta || currentMeta),
    incoming = normalizeEntries(data.glyphs, meta, !!restoredMeta);
  meta.revision++;
  return { library: [...incoming, ...library], meta, count: incoming.length };
}
export function upsertComposition(
  library: LibraryEntry[],
  currentMeta: LibraryMeta,
  source: Composition,
  model: GlyphModel,
) {
  const composition = parseComposition(source),
    meta = clone(currentMeta);
  const old = library.find((entry) => entry.id === composition.libraryId);
  const id = old?.id || crypto.randomUUID();
  const entry: LibraryEntry = {
    id,
    codePoint: old?.codePoint ?? allocateCode(meta),
    model: validModel(model),
    composition: { ...composition, libraryId: id },
  };
  meta.revision++;
  return {
    entry,
    meta,
    library: [entry, ...library.filter((item) => item.id !== id)],
  };
}
/** Renaming or re-saving an unchanged glyph must not discard its editable pieces. */
export function compositionForModel(
  entry: LibraryEntry | undefined,
  model: GlyphModel,
) {
  if (
    !entry?.composition ||
    entry.model.basePath !== model.basePath ||
    JSON.stringify(entry.model.operations) !== JSON.stringify(model.operations)
  )
    return undefined;
  return { ...clone(entry.composition), name: model.name };
}
export const fingerprint = (model: GlyphModel) =>
  JSON.stringify(validModel(model));
export const familyName = (meta: LibraryMeta) =>
  `KanjiMakerLibrary-${meta.id.replace(/-/g, "").slice(0, 8)}`;
export const appFile = (glyphs: LibraryEntry[], font: LibraryMeta) =>
  new Blob(
    [
      JSON.stringify(
        {
          format: "kanji-maker-library",
          version: 2,
          font,
          glyphs,
        } satisfies LibraryFile,
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
