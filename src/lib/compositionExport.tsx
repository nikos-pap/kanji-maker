import { renderToStaticMarkup } from "react-dom/server";
import { CompositionArtwork } from "../components/composer/CompositionArtwork";
import {
  compositionNeedsTracing,
  emptyComposition,
  transformedPath,
} from "./composition";
import type { Composition } from "./composition";
import type { GlyphModel } from "../types";
import { parseOutline, round } from "./geometry";
import { traceContours } from "./trace";
import { raster } from "./font";

export function compositionSvg(document: Composition) {
  return renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width="1000"
      height="1000"
      overflow="hidden"
    >
      <title>{document.name}</title>
      <CompositionArtwork parts={document.parts} prefix="export-component" />
    </svg>,
  );
}
export async function compositionCanvas(composition: Composition, size = 2048) {
  const url = URL.createObjectURL(
    new Blob([compositionSvg(composition)], { type: "image/svg+xml" }),
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
export async function compositionPng(composition: Composition) {
  const canvas = await compositionCanvas(composition);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("Could not create PNG."))),
      "image/png",
    ),
  );
}
function canvasOutline(canvas: HTMLCanvasElement) {
  const size = canvas.width;
  return traceContours(canvas)
    .map(
      (contour) =>
        contour
          .map(
            ([x, y], i) =>
              `${i ? "L" : "M"}${round((x * 1000) / size)} ${round(1000 - (y * 1000) / size)}`,
          )
          .join("") + "Z",
    )
    .join("");
}
export async function compositionFromGlyph(
  model: GlyphModel,
): Promise<Composition> {
  const path =
    !model.operations.length && parseOutline(model.basePath)
      ? model.basePath
      : canvasOutline(await raster(2048, model));
  return {
    ...emptyComposition(),
    name: model.name,
    parts: [
      {
        id: crypto.randomUUID(),
        kind: "radical",
        label: model.character || model.name,
        path,
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        crop: { x: 0, y: 0, width: 1000, height: 1000 },
        fontLabel: model.fontLabel,
        customFont: model.customFont,
      },
    ],
  };
}
export async function compositionModel(
  composition: Composition,
): Promise<GlyphModel> {
  if (!composition.parts.length) throw Error("Add a radical or stroke first.");
  let basePath: string;
  if (!compositionNeedsTracing(composition.parts))
    basePath = composition.parts.map(transformedPath).join("");
  else {
    basePath = canvasOutline(await compositionCanvas(composition));
  }
  const fonts = [
    ...new Set(composition.parts.map((p) => p.fontLabel).filter(Boolean)),
  ];
  return {
    version: 1,
    character: "",
    name: composition.name.trim() || "Radical composition",
    basePath,
    originalPath: basePath,
    operations: [],
    fontLabel: fonts.join(", ") || "Built-in strokes",
    customFont: composition.parts.some((p) => p.customFont),
  };
}
