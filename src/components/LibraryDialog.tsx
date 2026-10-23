import { useState } from "react";
import type { Editor } from "../hooks/useEditor";
import type { LibraryEntry } from "../types";
import { useCompactLayout } from "../hooks/useCompactLayout";
import { PanelDialog } from "./PanelDialog";
import { LibraryPanel } from "./LibraryPanel";

export function LibraryDialog({
  editor: e,
  busy = false,
  current,
  onOpen,
  onClose,
}: {
  editor: Editor;
  busy?: boolean;
  current?: string;
  onOpen?: (entry: LibraryEntry) => void;
  onClose: () => void;
}) {
  const compact = useCompactLayout();
  const [exportEntry, setExportEntry] = useState<LibraryEntry | null>(null);
  const [format, setFormat] = useState<"svg" | "png">("svg");
  const disabled = busy || e.busy;
  return (
    <PanelDialog
      id="libraryDialog"
      title="Library"
      compact={compact}
      className="library-dialog"
      closeLabel="Close library"
      onClose={onClose}
    >
      <LibraryPanel
        editor={e}
        busy={disabled}
        current={current}
        onOpen={
          onOpen ??
          ((entry) => {
            void e.openGlyph(entry).then((opened) => {
              if (opened) onClose();
            });
          })
        }
        onExport={(entry) => {
          setFormat("svg");
          setExportEntry(entry);
        }}
      />
      {exportEntry && (
        <PanelDialog
          id="libraryExportDialog"
          title="Export"
          className="library-export-dialog"
          closeLabel="Close export"
          onClose={() => setExportEntry(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void e.exportSavedImage(exportEntry, format).then((exported) => {
                if (exported) setExportEntry(null);
              });
            }}
          >
            <div
              className="library-image-formats"
              role="radiogroup"
              aria-label="Image format"
            >
              {(["svg", "png"] as const).map((kind) => (
                <label key={kind}>
                  <input
                    type="radio"
                    name="imageFormat"
                    value={kind}
                    checked={format === kind}
                    disabled={disabled}
                    onChange={() => setFormat(kind)}
                  />
                  {kind.toUpperCase()}
                </label>
              ))}
            </div>
            <button className="primary full" type="submit" disabled={disabled}>
              Export
            </button>
          </form>
        </PanelDialog>
      )}
    </PanelDialog>
  );
}
