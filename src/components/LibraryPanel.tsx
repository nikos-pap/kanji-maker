import { Glyph } from "./Glyph";
import { Icon } from "./Icon";
import type { Editor } from "../hooks/useEditor";
import type { LibraryEntry } from "../types";

export function LibraryPanel({
  editor: e,
  busy,
  current,
  onOpen,
  onExport,
  onNew,
}: {
  editor: Editor;
  busy: boolean;
  current?: string;
  onOpen: (entry: LibraryEntry) => void;
  onExport: (entry: LibraryEntry) => void;
  onNew?: () => void;
}) {
  return (
    <section className="library-panel" aria-label="Saved characters">
      {onNew && (
        <button disabled={busy} onClick={onNew}>
          New composition
        </button>
      )}
      <div id="library">
        {!e.library.length && (
          <div className="library-empty">No saved characters</div>
        )}
        {e.library.map((item) => (
          <div className="library-item" key={item.id}>
            <button
              className="library-load"
              aria-label={"Open " + item.model.name}
              aria-current={item.id === current ? "true" : undefined}
              disabled={busy}
              onClick={() => onOpen(item)}
            >
              <Glyph model={item.model} prefix={"library-" + item.id} />
              <span className="library-label">
                <span>{item.model.name || "Untitled"}</span>
                <small>
                  {item.composition
                    ? item.composition.parts.length + " components"
                    : "Character"}
                </small>
              </span>
            </button>
            <button
              className="library-export"
              title={"Export " + item.model.name}
              aria-label={"Export " + item.model.name}
              disabled={busy}
              onClick={() => onExport(item)}
            >
              <Icon name="export" width="18" height="18" />
            </button>
            <button
              className="library-delete"
              aria-label={"Delete " + item.model.name}
              disabled={busy}
              onClick={() => void e.removeGlyph(item)}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="library-exports">
        <button
          id="exportLibraryWord"
          className="primary full"
          disabled={!e.library.length || busy}
          onClick={() => e.exportLibrary("word")}
        >
          Word (.docx)
        </button>
        <button
          id="exportLibraryFont"
          className="full"
          disabled={!e.library.length || busy}
          onClick={() => e.exportLibrary("font")}
        >
          Font (.ttf)
        </button>
        <button
          id="exportProject"
          className="quiet full"
          disabled={!e.library.length || busy}
          onClick={() => e.exportLibrary("json")}
        >
          Backup (.json)
        </button>
      </div>
    </section>
  );
}
