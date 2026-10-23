import { describe, expect, it } from "vitest";
import fontkit from "@pdf-lib/fontkit";
import { makeDocx, makeFont } from "../../src/lib/exports";
import {
  activePoint,
  outlineText,
  parseOutline,
  shiftedOutline,
} from "../../src/lib/geometry";
import {
  allocateCode,
  importLibrary,
  newMeta,
  validModel,
} from "../../src/lib/storage";
import type { GlyphModel, LibraryEntry } from "../../src/types";

const model: GlyphModel = {
  version: 1,
  character: "長",
  name: "Test",
  basePath: "M10 20L90 20L90 80L10 20Z",
  originalPath: "M10 20L90 20L90 80L10 20Z",
  operations: [],
};
describe("outline editing", () => {
  it("moves a closing anchor together with its matching start and leaves the source unchanged", () => {
    const source = parseOutline(model.basePath)!,
      selection = { contour: 0, command: 0, pair: 0 };
    const next = shiftedOutline(source, selection, 5, 10);
    expect(activePoint(next, selection)).toEqual([15, 30]);
    expect(next[0][3].values).toEqual([15, 30]);
    expect(outlineText(source)).toBe(model.basePath);
  });
  it("clamps a whole contour to the canvas bounds", () => {
    const next = shiftedOutline(
      parseOutline(model.basePath)!,
      { contour: 0, command: null, pair: null },
      -100,
      1000,
    );
    expect(next[0][0].values).toEqual([0, 940]);
  });
});
describe("library compatibility", () => {
  it("preserves square tips and old polygon/round edits without changing legacy files", () => {
    const oldStroke = { kind: "erase", width: 30, points: [[20, 20]] };
    const squareStroke = {
      kind: "draw",
      width: 30,
      brushShape: "square",
      points: [[40, 40]],
    };
    const polygon = {
      kind: "polygon",
      width: 1,
      points: [
        [0, 0],
        [20, 0],
        [20, 20],
      ],
    };
    const restored = validModel({
      ...model,
      operations: [oldStroke, squareStroke, polygon],
    });
    expect(restored.operations).toEqual([oldStroke, squareStroke, polygon]);
    expect(() =>
      validModel({
        ...model,
        operations: [{ ...squareStroke, brushShape: "triangle" }],
      }),
    ).toThrow("Invalid brush shape");
  });
  const entries: LibraryEntry[] = [
    { id: crypto.randomUUID(), codePoint: 0xe050, model },
  ];
  const backupMeta = { ...newMeta(), nextCodePoint: 0xe080 };
  const backup = {
    format: "kanji-maker-library",
    version: 2,
    font: backupMeta,
    glyphs: entries,
  };
  it("restores original codes and font identity into an empty library", () => {
    const restored = importLibrary(backup, [], newMeta());
    expect(restored.library[0].codePoint).toBe(0xe050);
    expect(restored.meta.id).toBe(backupMeta.id);
    expect(allocateCode(restored.meta)).toBe(0xe080);
  });
  it("allocates fresh codes when importing into a populated library", () => {
    const meta = { ...newMeta(), nextCodePoint: 0xe051 },
      result = importLibrary(backup, entries, meta);
    expect(result.library[0].codePoint).toBe(0xe051);
    expect(result.library[0].id).not.toBe(entries[0].id);
    expect(result.meta.id).toBe(meta.id);
  });
  it("accepts version 1 backups and rejects malformed outlines and strokes", () => {
    expect(
      importLibrary({ ...backup, version: 1 }, [], newMeta()).library[0]
        .codePoint,
    ).toBe(0xe000);
    expect(() => validModel({ ...model, basePath: "<script>" })).toThrow();
    expect(() =>
      validModel({
        ...model,
        operations: [{ kind: "draw", width: 1, points: [[NaN, 2]] }],
      }),
    ).toThrow();
  });
});
it("exports parseable fonts with the assigned code and embedded-font Word documents", async () => {
  const bytes = makeFont(
    [
      {
        codePoint: 0xe050,
        contours: [
          [
            [0, 0],
            [500, 0],
            [500, 500],
            [0, 0],
          ],
        ],
      },
    ],
    "TestFamily",
    "Test licence",
  );
  const font = fontkit.create(bytes);
  expect(font.hasGlyphForCodePoint(0xe050)).toBe(true);
  expect(font.familyName).toBe("TestFamily");
  const doc = makeDocx(bytes, "TestFamily", [
    { codePoint: 0xe050, name: "Test" },
  ]);
  const data = new Uint8Array(await doc.arrayBuffer());
  expect([...data.slice(0, 4)]).toEqual([0x50, 0x4b, 3, 4]);
  expect(new TextDecoder().decode(data)).toContain("word/fonts/library.odttf");
});
