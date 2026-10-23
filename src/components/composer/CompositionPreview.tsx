import { useEffect, useState } from "react";
import type { Composition } from "../../lib/composition";
import { compositionModel } from "../../lib/compositionExport";
import {
  PREVIEW_CHARACTER,
  PREVIEW_LINES,
  textPreviewFont,
} from "../../lib/textPreview";
import type { Editor } from "../../hooks/useEditor";

export function CompositionPreview({
  composition,
  getOutline,
}: {
  composition: Composition;
  getOutline: Editor["getCharacterOutline"];
}) {
  const [family, setFamily] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      face: FontFace | undefined;
    setFamily("");
    setError("");
    void (async () => {
      const model = await compositionModel(composition);
      const bytes = await textPreviewFont(model, getOutline);
      const name = `KanjiPreview-${crypto.randomUUID()}`;
      face = new FontFace(name, bytes.slice().buffer);
      await face.load();
      if (cancelled) return;
      document.fonts.add(face);
      setFamily(name);
    })().catch((error) => {
      if (!cancelled)
        setError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      if (face) document.fonts.delete(face);
    };
  }, [composition, getOutline]);
  if (error) return <p role="alert">{error}</p>;
  if (!family) return <p role="status">Preparing text preview…</p>;
  return (
    <div
      className="composition-text-preview"
      aria-label="Composition beside real kanji"
      style={{ fontFamily: `"${family}"` }}
    >
      {PREVIEW_LINES.map((line, i) => (
        <p key={line} style={{ fontSize: [28, 40, 56][i] }}>
          {line.split(PREVIEW_CHARACTER).map((text, index) => (
            <span key={index}>
              {index > 0 && <mark>{PREVIEW_CHARACTER}</mark>}
              {text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
