import type { GlyphModel } from "../types";
import { Glyph } from "./Glyph";

export function GlyphPreview({ model }: { model: GlyphModel }) {
  return (
    <section className="preview-panel">
      <h2>Preview</h2>
      <div
        id="textPreview"
        className="text-preview"
        aria-label="Custom character preview"
      >
        あ<Glyph model={model} prefix="preview" />い
      </div>
    </section>
  );
}
