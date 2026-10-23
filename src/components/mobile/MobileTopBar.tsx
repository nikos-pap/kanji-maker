import { useRef } from "react";
import type { Editor } from "../../hooks/useEditor";
import { Icon } from "../Icon";

type Props = { editor: Editor; onCharacters: () => void; onExport: () => void };
export function MobileTopBar({ editor: e, onCharacters, onExport }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="phone-topbar" role="toolbar" aria-label="Editor actions">
      <button
        className="phone-character"
        aria-label="Choose character or open library"
        title="Character and library"
        onClick={onCharacters}
      >
        <span>{e.model.character || "字"}</span>
        <Icon name="chevron" width="12" height="12" />
      </button>
      <div className="phone-history" role="group" aria-label="Edit history">
        <button
          aria-label="Undo"
          title="Undo"
          disabled={!e.past.length || e.busy}
          onClick={e.undo}
        >
          <Icon name="undo" />
        </button>
        <button
          aria-label="Redo"
          title="Redo"
          disabled={!e.future.length || e.busy}
          onClick={e.redo}
        >
          <Icon name="redo" />
        </button>
      </div>
      <div className="phone-file-actions">
        <button
          aria-label="Save to library"
          title="Save"
          disabled={e.disabled}
          onClick={e.saveGlyph}
        >
          <Icon name="save" />
        </button>
        <button
          aria-label="Import app file"
          title="Import"
          disabled={e.busy}
          onClick={() => input.current?.click()}
        >
          <Icon name="import" />
        </button>
        <button aria-label="Export and copy" title="Export" onClick={onExport}>
          <Icon name="export" />
        </button>
      </div>
      <input
        ref={input}
        id="phoneImportFile"
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void e.importFile(file);
        }}
      />
    </div>
  );
}
