import fontkit from "@pdf-lib/fontkit";
import { renderToStaticMarkup } from "react-dom/server";
import fontUrl from "../../assets/fonts/N5PDFSerif-Regular.ttf?url";
import licence from "../../assets/fonts/OFL.txt?raw";
import { Glyph } from "../components/Glyph";
import { glyphPath, parseOutline } from "./geometry";
import { traceContours } from "./trace";
import { makeFont } from "./exports";
import { validCode } from "./storage";
import type {
  FontEntry,
  FontPoint,
  GlyphModel,
  LibraryEntry,
  SourceFont,
} from "../types";

export function parseFont(bytes: Uint8Array): SourceFont {
  const font = fontkit.create(bytes);
  if (!("glyphForCodePoint" in font))
    throw Error(
      "Choose an individual TTF, OTF or WOFF font, rather than a font collection.",
    );
  // Fontkit exposes path.commands at runtime but omits it from its Path type.
  return font as unknown as SourceFont;
}
export async function loadIncludedFont(signal: AbortSignal) {
  const response = await fetch(fontUrl, { signal });
  if (!response.ok) throw Error("The included font could not be downloaded.");
  const font = parseFont(new Uint8Array(await response.arrayBuffer()));
  return { font, licence: `${font.copyright}\n\n${licence}` };
}
export const svgText = (model: GlyphModel) =>
  renderToStaticMarkup(<Glyph model={model} prefix="export" title />);
export async function raster(
  size: number,
  model: GlyphModel,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(
    new Blob([svgText(model)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Canvas drawing is unavailable.");
    context.drawImage(image, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function png(model: GlyphModel, size = 2048): Promise<Blob> {
  const canvas = await raster(size, model);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("Could not create PNG."))),
      "image/png",
    ),
  );
}
export async function outlineForModel(
  model: GlyphModel,
): Promise<FontPoint[][]> {
  const source = parseOutline(model.basePath);
  if (
    !model.operations.length &&
    source?.length &&
    source.every((c) =>
      c.every(
        (p) => p.cmd !== "C" && p.values.every((n) => n >= 0 && n <= 1000),
      ),
    )
  ) {
    return source.map((c) =>
      c.flatMap((p) => {
        if (p.cmd === "Z") return [];
        const point = (i: number, on: boolean): FontPoint => [
          Math.round(p.values[i] * 2.048),
          Math.round((1000 - p.values[i + 1]) * 2.048),
          on,
        ];
        return p.cmd === "Q"
          ? [point(0, false), point(2, true)]
          : [point(0, true)];
      }),
    );
  }
  return traceContours(await raster(2048, model));
}
export async function libraryFont(
  items: LibraryEntry[],
  family: string,
  revision: number,
  licence: string,
  fonts: SourceFont[],
  progress: (message: string) => void,
) {
  const entries: FontEntry[] = [];
  for (const [i, item] of items.entries()) {
    progress(`Preparing ${i + 1} of ${items.length} characters…`);
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    try {
      entries.push({
        codePoint: item.codePoint,
        contours: await outlineForModel(item.model),
      });
    } catch (error) {
      throw Error(
        `${item.model.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const normal = new Set(
    items
      .flatMap((g) => [...`${g.model.name}${g.model.character}`])
      .map((c) => c.codePointAt(0)!)
      .filter((c) => c > 127 && !validCode(c)),
  );
  for (const codePoint of normal) {
    const face = fonts.find((f) => f.hasGlyphForCodePoint(codePoint));
    if (!face) continue;
    const basePath = glyphPath(face, String.fromCodePoint(codePoint));
    if (basePath)
      entries.push({
        codePoint,
        contours: await outlineForModel({
          version: 1,
          character: "",
          name: "Label",
          basePath,
          operations: [],
        }),
      });
  }
  const customSources = [
    ...new Set(
      items.filter((g) => g.model.customFont).map((g) => g.model.fontLabel),
    ),
  ];
  const text =
    licence +
    (customSources.length
      ? `\nAdditional outlines were created from user-selected fonts: ${customSources.join(", ")}. Their source licences apply to those outlines.`
      : "");
  const bytes = makeFont(entries, family, text, revision),
    check = parseFont(bytes);
  if (!items.every((g) => check.hasGlyphForCodePoint(g.codePoint)))
    throw Error("Library font validation failed.");
  return bytes;
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
