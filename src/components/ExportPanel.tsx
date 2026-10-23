import type { Editor } from "../hooks/useEditor";

type ExportPanelState = Pick<
  Editor,
  | "disabled"
  | "copyMode"
  | "currentEntry"
  | "model"
  | "busy"
  | "changeModel"
  | "saveGlyph"
  | "exportCurrent"
  | "copyCharacter"
  | "setCopyMode"
  | "copyForDocument"
>;
export function ExportPanel({ editor: e }: { editor: ExportPanelState }) {
  const copyDisabled = e.disabled || (e.copyMode === "text" && !e.currentEntry);
  return (
    <section className="export-panel">
      <h2>Current character</h2>
      <label htmlFor="glyphName">Name</label>
      <input
        id="glyphName"
        value={e.model.name}
        maxLength={80}
        autoComplete="off"
        disabled={e.busy}
        onChange={(event) =>
          e.changeModel({ ...e.model, name: event.currentTarget.value })
        }
      />
      <button
        id="saveGlyph"
        className="primary full"
        disabled={e.disabled}
        onClick={e.saveGlyph}
      >
        Save to library
      </button>
      <div className="export-buttons">
        <button
          id="exportFont"
          title="Single-character font at U+E000"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("font")}
        >
          Font
        </button>
        <button
          id="exportCharacterProject"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("json")}
        >
          App file
        </button>
      </div>
      <button
        id="copyCharacter"
        className="text-button"
        onClick={() => void e.copyCharacter()}
      >
        Copy font character
      </button>
      <div className="copy-document">
        <label htmlFor="copyDocumentMode">Copy as</label>
        <select
          id="copyDocumentMode"
          value={e.copyMode}
          onChange={(event) =>
            e.setCopyMode(event.currentTarget.value as "text" | "image")
          }
        >
          <option value="text">Editable text</option>
          <option value="image">Transparent image</option>
        </select>
        <button
          id="copyDocument"
          className="full"
          disabled={copyDisabled}
          onClick={() => void e.copyForDocument()}
        >
          Copy
        </button>
        {e.copyMode === "text" && (
          <p id="copyDocumentHint" className="small">
            {e.currentEntry
              ? "Requires the installed library font."
              : "Save to library first."}
          </p>
        )}
      </div>
    </section>
  );
}
