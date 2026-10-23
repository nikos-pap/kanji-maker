import { makeFont } from "./exports";
import { outlineForModel } from "./font";
import type { GlyphModel, FontEntry } from "../types";

export const PREVIEW_CHARACTER = "\uE000";
export const PREVIEW_LINES = [
  `日本${PREVIEW_CHARACTER}文字`,
  `山川${PREVIEW_CHARACTER}田`,
  `日月${PREVIEW_CHARACTER}木`,
];
export const PREVIEW_REFERENCES = [
  ...new Set(
    [...PREVIEW_LINES.join("")].filter((c) => c !== PREVIEW_CHARACTER),
  ),
];

export async function textPreviewFont(
  model: GlyphModel,
  getOutline: (character: string) => { path: string },
) {
  const entries: FontEntry[] = [
    { codePoint: 0xe000, contours: await outlineForModel(model) },
  ];
  for (const character of PREVIEW_REFERENCES) {
    const basePath = getOutline(character).path;
    entries.push({
      codePoint: character.codePointAt(0)!,
      contours: await outlineForModel({
        version: 1,
        character,
        name: character,
        basePath,
        operations: [],
      }),
    });
  }
  return makeFont(
    entries,
    "KanjiMakerPreview",
    "Temporary preview font; source font licences apply.",
  );
}
