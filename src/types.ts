import type { Composition } from "./lib/composition";

export type Point = [number, number];
export type StrokeKind = "erase" | "cut" | "polygon" | "draw" | "line";
export type Tool = Exclude<StrokeKind, "polygon"> | "points";
export type BrushShape = "round" | "square";
export interface Operation {
  kind: StrokeKind;
  width: number;
  points: Point[];
  brushShape?: BrushShape;
}
export interface GlyphModel {
  version: 1;
  character: string;
  name: string;
  basePath: string;
  originalPath?: string;
  operations: Operation[];
  fontLabel?: string;
  customFont?: boolean;
}
export interface LibraryEntry {
  id: string;
  codePoint: number;
  model: GlyphModel;
  composition?: Composition;
}
export interface LibraryMeta {
  id: string;
  nextCodePoint: number;
  revision: number;
}
export interface LibraryFile {
  format: "kanji-maker-library";
  version: 2;
  font: LibraryMeta;
  glyphs: LibraryEntry[];
}
export interface OutlineCommand {
  cmd: string;
  values: number[];
}
export type Outline = OutlineCommand[][];
export interface Selection {
  contour: number;
  command: number | null;
  pair: number | null;
}
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
export type FontPoint = [number, number, boolean?];
export interface FontEntry {
  codePoint: number;
  contours: FontPoint[][];
}
export interface SourceFont {
  copyright: string;
  unitsPerEm: number;
  hasGlyphForCodePoint(code: number): boolean;
  glyphForCodePoint(code: number): {
    advanceWidth: number;
    path: { commands: { command: string; args: number[] }[] };
  };
}
