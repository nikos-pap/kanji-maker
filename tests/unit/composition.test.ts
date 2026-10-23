import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import {
  createPart,
  partBounds,
  resizePart,
  cropPart,
  parseComposition,
  emptyComposition,
  transformedPath,
  compositionNeedsTracing,
} from "../../src/lib/composition";
import {
  compositionModel,
  compositionSvg,
  compositionFromGlyph,
} from "../../src/lib/compositionExport";
import {
  upsertComposition,
  newMeta,
  importLibrary,
  appFile,
  compositionForModel,
} from "../../src/lib/storage";
import { textPreviewFont, PREVIEW_REFERENCES } from "../../src/lib/textPreview";
import { parseOutline, glyphPath } from "../../src/lib/geometry";
import {
  KANGXI_RADICALS,
  RADICALS,
  STROKES,
} from "../../src/lib/componentCatalog";
import type { SourceFont } from "../../src/types";

const source = {
  kind: "stroke" as const,
  label: "Block",
  path: "M100 200L900 200L900 600L100 600Z",
};
const part = createPart(source, "test-part");
describe("component transforms and cropping", () => {
  it("adds an independently editable source with its original aspect ratio", () => {
    expect(part).toMatchObject({
      width: 600,
      height: 300,
      x: 200,
      y: 350,
      crop: { x: 0, y: 0, width: 1000, height: 1000 },
    });
    expect(parseOutline(part.path)![0][0].values).toEqual([0, 0]);
    expect(source.path).toBe("M100 200L900 200L900 600L100 600Z");
  });
  it("crops in source space and preserves that crop when resized", () => {
    const cropped = cropPart(part, "w", [350, 350]);
    expect(cropped.crop).toEqual({ x: 250, y: 0, width: 750, height: 1000 });
    expect(cropped.path).toBe(part.path);
    expect(partBounds(cropped)).toEqual({
      x: 350,
      y: 350,
      width: 450,
      height: 300,
    });
    const resized = resizePart(cropped, {
      x: 100,
      y: 200,
      width: 600,
      height: 400,
    });
    expect(resized.crop).toEqual(cropped.crop);
    expect(partBounds(resized)).toEqual({
      x: 100,
      y: 200,
      width: 600,
      height: 400,
    });
  });
  it("never reverses or empties a crop when its handles cross", () => {
    const cropped = cropPart(part, "nw", [2000, 2000]);
    expect(cropped.crop).toEqual({ x: 990, y: 990, width: 10, height: 10 });
    const expanded = cropPart(cropped, "nw", [-2000, -2000]);
    expect(expanded.crop).toEqual(part.crop);
  });
  it("transforms every control point of a curved stroke", () => {
    const curved = {
      ...part,
      x: 10,
      y: 20,
      width: 200,
      height: 300,
      path: "M0 0Q500 1000 1000 0Z",
    };
    expect(transformedPath(curved)).toBe("M10 20Q110 320 210 20Z");
  });
  it("merges overlapping ink while preserving separate vector paths for disjoint pieces", () => {
    expect(
      compositionNeedsTracing([part, { ...part, id: "second", x: 300 }]),
    ).toBe(true);
    expect(
      compositionNeedsTracing([part, { ...part, id: "second", x: 900 }]),
    ).toBe(false);
    expect(
      compositionNeedsTracing([
        { ...part, crop: { x: 0, y: 0, width: 500, height: 1000 } },
      ]),
    ).toBe(true);
  });
});
describe("composition persistence and exports", () => {
  const project = { ...emptyComposition(), parts: [part] };
  it("round trips editable components, transforms and source crops", () => {
    const loaded = parseComposition(JSON.parse(JSON.stringify(project)));
    expect(loaded).toEqual(project);
    loaded.parts[0].crop.width = 500;
    expect(part.crop.width).toBe(1000);
  });
  it("rejects duplicate IDs, invalid paths and source crops outside the component", () => {
    expect(() =>
      parseComposition({ ...project, parts: [part, part] }),
    ).toThrow();
    expect(() =>
      parseComposition({ ...project, parts: [{ ...part, path: "<script>" }] }),
    ).toThrow();
    expect(() =>
      parseComposition({
        ...project,
        parts: [{ ...part, crop: { x: 800, y: 0, width: 400, height: 1000 } }],
      }),
    ).toThrow();
    expect(() =>
      parseComposition({ ...project, parts: [{ ...part, width: NaN }] }),
    ).toThrow();
  });
  it("exports source curves and crop clips without editor controls", () => {
    const svg = compositionSvg({
      ...project,
      parts: [{ ...part, crop: { x: 250, y: 100, width: 500, height: 800 } }],
    });
    expect(svg).toContain('clipPathUnits="userSpaceOnUse"');
    expect(svg).toContain('x="250" y="100" width="500" height="800"');
    expect(svg).toContain(part.path);
    expect(svg).not.toContain("data-handle");
    expect(svg).not.toContain("compositionChecks");
  });
  it("opens uncropped vector components as a standard editor glyph", async () => {
    const model = await compositionModel(project);
    expect(model.basePath).toBe(transformedPath(part));
    expect(model.operations).toEqual([]);
    expect(model.originalPath).toBe(model.basePath);
    await expect(compositionModel(emptyComposition())).rejects.toThrow(
      "Add a radical or stroke",
    );
  });
});
describe("shared composition library", () => {
  it("preserves pieces when the drawing editor renames a glyph, and drops stale pieces after drawing changes", async () => {
    const document = { ...emptyComposition(), parts: [part] },
      model = await compositionModel(document);
    const saved = upsertComposition([], newMeta(), document, model).entry;
    const renamed = compositionForModel(saved, { ...model, name: "Renamed" });
    expect(renamed?.name).toBe("Renamed");
    expect(renamed?.parts).toEqual(saved.composition?.parts);
    expect(saved.composition?.name).not.toBe("Renamed");
    expect(
      compositionForModel(saved, { ...model, basePath: "M0 0L10 10L20 0Z" }),
    ).toBeUndefined();
    expect(
      compositionForModel(saved, {
        ...model,
        operations: [{ kind: "draw", width: 20, points: [[500, 500]] }],
      }),
    ).toBeUndefined();
  });
  it("saves editable parts alongside a glyph and updates the same character code", async () => {
    const document = { ...emptyComposition(), parts: [part] };
    const model = await compositionModel(document),
      originalMeta = newMeta();
    const saved = upsertComposition([], originalMeta, document, model);
    expect(originalMeta.nextCodePoint).toBe(0xe000);
    expect(saved.entry.codePoint).toBe(0xe000);
    expect(saved.entry.composition?.libraryId).toBe(saved.entry.id);
    const changed = {
      ...saved.entry.composition!,
      name: "Changed",
      parts: [{ ...part, crop: { x: 250, y: 0, width: 750, height: 1000 } }],
    };
    const updated = upsertComposition(saved.library, saved.meta, changed, {
      ...model,
      name: "Changed",
    });
    expect(updated.library).toHaveLength(1);
    expect(updated.entry.id).toBe(saved.entry.id);
    expect(updated.entry.codePoint).toBe(saved.entry.codePoint);
    expect(updated.meta.nextCodePoint).toBe(saved.meta.nextCodePoint);
    expect(updated.entry.composition?.parts[0].crop.x).toBe(250);
    expect(saved.entry.composition?.parts[0].crop.x).toBe(0);
  });
  it("keeps the editable composition through library backup, restore and merge", async () => {
    const document = { ...emptyComposition(), parts: [part] },
      model = await compositionModel(document);
    const saved = upsertComposition([], newMeta(), document, model);
    const backup = JSON.parse(await appFile(saved.library, saved.meta).text());
    const restored = importLibrary(backup, [], newMeta());
    expect(restored.library[0].composition?.parts).toEqual(
      saved.entry.composition?.parts,
    );
    expect(restored.library[0].composition?.libraryId).toBe(
      restored.library[0].id,
    );
    const merged = importLibrary(backup, saved.library, saved.meta);
    expect(merged.library[0].id).not.toBe(saved.entry.id);
    expect(merged.library[0].composition?.libraryId).toBe(merged.library[0].id);
    expect(merged.library[0].codePoint).not.toBe(saved.entry.codePoint);
  });
  it("opens a normal library character as one full-size component", async () => {
    const model = await compositionModel({
      ...emptyComposition(),
      parts: [part],
    });
    const composition = await compositionFromGlyph(model);
    expect(composition.parts).toHaveLength(1);
    expect(composition.parts[0]).toMatchObject({
      path: model.basePath,
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
    expect((await compositionModel(composition)).basePath).toBe(model.basePath);
  });
});

it("builds a text preview font with the custom character and every reference kanji", async () => {
  const model = await compositionModel({
    ...emptyComposition(),
    parts: [part],
  });
  const referenceFont = fontkit.create(
    new Uint8Array(readFileSync("assets/fonts/N5PDFSerif-Regular.ttf")),
  ) as unknown as SourceFont;
  const bytes = await textPreviewFont(model, (character) => ({
    path: glyphPath(referenceFont, character),
  }));
  const font = fontkit.create(bytes) as unknown as SourceFont;
  expect(font.hasGlyphForCodePoint(0xe000)).toBe(true);
  expect(font.glyphForCodePoint(0xe000).advanceWidth).toBe(font.unitsPerEm);
  expect(
    font.glyphForCodePoint("日".codePointAt(0)!).path.commands.length,
  ).toBeGreaterThan(4);
  for (const character of PREVIEW_REFERENCES)
    expect(font.hasGlyphForCodePoint(character.codePointAt(0)!)).toBe(true);
});

describe("component catalog", () => {
  it("contains all 214 canonical radicals in traditional stroke order", () => {
    expect(KANGXI_RADICALS).toHaveLength(214);
    expect(KANGXI_RADICALS.map((r) => r.number)).toEqual(
      Array.from({ length: 214 }, (_, i) => i + 1),
    );
    expect(new Set(KANGXI_RADICALS.map((r) => r.character)).size).toBe(214);
    expect(
      Array.from(
        { length: 17 },
        (_, i) => KANGXI_RADICALS.filter((r) => r.strokes === i + 1).length,
      ),
    ).toEqual([6, 23, 31, 34, 23, 29, 20, 9, 11, 8, 6, 4, 4, 2, 1, 2, 1]);
    expect(RADICALS.map((r) => r.strokes)).toEqual(
      [...RADICALS.map((r) => r.strokes)].sort((a, b) => a - b),
    );
  });
  it("contains usable filled outlines for every built-in stroke", () => {
    for (const stroke of STROKES)
      expect(
        createPart(
          { ...stroke, kind: "stroke" },
          stroke.label.replaceAll(" ", "-"),
        ).path,
      ).toMatch(/^M/);
  });
  it("can add all preset radicals from the included font", () => {
    const font = fontkit.create(
      new Uint8Array(readFileSync("assets/fonts/N5PDFSerif-Regular.ttf")),
    ) as unknown as SourceFont;
    const missing = RADICALS.filter(
      ({ character }) => !font.hasGlyphForCodePoint(character.codePointAt(0)!),
    );
    expect(missing.map(({ character }) => character)).toEqual([]);
    for (const { character } of RADICALS)
      expect(
        createPart(
          {
            kind: "radical",
            label: character,
            path: glyphPath(font, character),
          },
          `r-${character.codePointAt(0)}`,
        ).width,
      ).toBeGreaterThan(0);
  });
});
