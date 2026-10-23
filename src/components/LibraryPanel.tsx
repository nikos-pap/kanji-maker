import { useRef } from "react";
import { Glyph } from "./Glyph";
import type { Editor } from "../hooks/useEditor";

type LibraryPanelState = Pick<
  Editor,
  | "busy"
  | "library"
  | "openGlyph"
  | "copyForDocument"
  | "removeGlyph"
  | "exportLibrary"
  | "importFile"
>;
export function LibraryPanel({ editor: e }: { editor: LibraryPanelState }) {
  const projectInput = useRef<HTMLInputElement>(null);
  return (
    <section className="library-panel">
      <div className="section-heading">
        <h2>Your library</h2>
        <button
          id="importProject"
          className="text-button"
          disabled={e.busy}
          onClick={() => projectInput.current?.click()}
        >
          Import app file
        </button>
      </div>
      <div id="library">
        {!e.library.length && (
          <div className="library-empty">No saved characters</div>
        )}
        {e.library.map((item) => (
          <div className="library-item" key={item.id}>
            <button
              className="library-load"
              title={`Edit ${item.model.name} · U+${item.codePoint.toString(16).toUpperCase()}`}
              disabled={e.busy}
              onClick={() => void e.openGlyph(item)}
            >
              <Glyph model={item.model} prefix={`library-${item.id}`} />
              <span className="library-label">
                <span>{item.model.name || "Untitled"}</span>
              </span>
            </button>
            <button
              className="library-copy"
              title={`Copy ${item.model.name} for another document`}
              aria-label={`Copy ${item.model.name} for another document`}
              disabled={e.busy}
              onClick={() => void e.copyForDocument(item)}
            >
              ⧉
            </button>
            <button
              className="library-delete"
              aria-label={`Delete ${item.model.name}`}
              disabled={e.busy}
              onClick={() => void e.removeGlyph(item)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="library-exports">
        <button
          id="exportLibraryWord"
          className="primary full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("word")}
        >
          Word (.docx)
        </button>
        <button
          id="exportLibraryFont"
          className="full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("font")}
        >
          Font (.ttf)
        </button>
        <button
          id="exportProject"
          className="quiet full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("json")}
        >
          Backup (.json)
        </button>
      </div>
      <input
        ref={projectInput}
        type="file"
        id="projectFile"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void e.importFile(file);
        }}
      />
    </section>
  );
}
