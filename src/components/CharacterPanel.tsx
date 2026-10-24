import type { Editor } from "../hooks/useEditor";

type CharacterPanelState = Pick<
  Editor,
  | "disabled"
  | "copyMode"
  | "currentEntry"
  | "model"
  | "busy"
  | "changeModel"
  | "setCopyMode"
  | "copyForDocument"
>;
export function CharacterPanel({ editor: e }: { editor: CharacterPanelState }) {
  const copyDisabled = e.disabled || (e.copyMode === "text" && !e.currentEntry);
  return (
    <section className="character-panel">
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
