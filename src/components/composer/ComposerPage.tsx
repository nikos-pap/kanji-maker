import { useEffect, useRef, useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import type { LibraryEntry } from "../../types";
import { useCompactLayout } from "../../hooks/useCompactLayout";
import { useComposition } from "../../hooks/useComposition";
import { createPart } from "../../lib/composition";
import {
  compositionFromGlyph,
  compositionModel,
} from "../../lib/compositionExport";
import { ComponentPicker } from "./ComponentPicker";
import type { ComponentSource } from "./ComponentPicker";
import { ComponentInspector } from "./ComponentInspector";
import { CompositionCanvas } from "./CompositionCanvas";
import { ComposerDialog } from "./ComposerDialog";
import { LibraryDialog } from "../LibraryDialog";
import { CompositionPreview } from "./CompositionPreview";
import { Icon } from "../Icon";
import { HistoryControls } from "../HistoryControls";
import { ImportButton } from "../ImportButton";
import "../../composer.css";

type Sheet = "add" | "settings" | "library" | "preview";
const titles: Record<Sheet, string> = {
  add: "Add radical or stroke",
  settings: "Component settings",
  library: "Library",
  preview: "Text preview",
};
export function ComposerPage({ editor: e }: { editor: Editor }) {
  const c = useComposition(e.notify);
  const compact = useCompactLayout();
  const [crop, setCrop] = useState(false),
    [guides, setGuides] = useState(true),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  useEffect(() => {
    if (!compact && (sheet === "add" || sheet === "settings")) setSheet(null);
  }, [compact, sheet]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        (event.target as Element).closest("input,textarea,select,dialog") ||
        c.gesturing ||
        busy
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        if (event.shiftKey || event.key.toLowerCase() === "y") c.redo();
        else c.undo();
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  });
  function add(source: ComponentSource) {
    try {
      c.add(
        createPart(
          source,
          crypto.randomUUID(),
          (c.document.parts.length % 5) * 18,
        ),
      );
      setSheet(null);
      setCrop(false);
    } catch (error) {
      e.notify(error instanceof Error ? error.message : String(error), true);
    }
  }
  async function run(action: () => Promise<void>) {
    if (running.current || c.gesturing) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      e.notify(error instanceof Error ? error.message : String(error), true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || c.gesturing || !c.document.parts.length;
  const save = () =>
    run(async () => {
      const model = await compositionModel(c.document);
      const id = e.saveComposition(c.document, model);
      if (id) c.markSaved(id);
    });
  const edit = () =>
    run(async () => {
      if (!c.document.parts.length) {
        location.hash = "editor";
        return;
      }
      const model = await compositionModel(c.document);
      if (await e.openComposition(model)) location.hash = "editor";
    });
  const open = (entry: LibraryEntry) =>
    run(async () => {
      const composition = entry.composition
        ? structuredClone(entry.composition)
        : await compositionFromGlyph(entry.model);
      c.openDocument({ ...composition, libraryId: entry.id });
      setCrop(false);
      setSheet(null);
    });
  const inspector = <ComponentInspector composer={c} />;
  return (
    <div className="composer-page" data-compact={compact}>
      <header className="composer-header">
        <button
          className="primary composer-edit"
          aria-busy={busy}
          disabled={busy || c.gesturing}
          onClick={() => void edit()}
          aria-label="Open composition in character editor"
        >
          {busy ? "…" : "Editor"}
          <Icon name="draw" width="18" height="18" />
        </button>
        <h1>Radicals &amp; strokes</h1>
        <HistoryControls
          canUndo={!!c.past.length}
          canRedo={!!c.future.length}
          canClear={!!c.document.parts.length}
          disabled={busy || e.busy || c.gesturing}
          onUndo={c.undo}
          onRedo={c.redo}
          onClear={() => {
            c.clear();
            setCrop(false);
          }}
        />
        <div className="composer-header-actions">
          <button
            aria-label="Open composition library"
            title="Library"
            disabled={busy || c.gesturing}
            onClick={() => setSheet("library")}
          >
            <Icon name="library" />
          </button>
          <button
            aria-label="Save composition to library"
            title="Save"
            disabled={disabled}
            onClick={() => void save()}
          >
            <Icon name="save" />
          </button>
          <ImportButton
            id="compositionImportFile"
            disabled={busy || e.busy || c.gesturing}
            onImport={e.importFile}
          />
        </div>
      </header>
      <div
        className="composer-toolbar"
        role="toolbar"
        aria-label="Composition tools"
      >
        {compact && (
          <button
            className="primary composer-add"
            aria-label="Add radical or stroke"
            title="Add radical or stroke"
            onClick={() => setSheet("add")}
          >
            <Icon name="add" width="20" height="20" />
          </button>
        )}
        <div className="component-mode">
          <button
            aria-label="Move and resize components"
            title="Move / resize"
            aria-pressed={!crop}
            onClick={() => setCrop(false)}
          >
            <Icon name="resize" width="18" height="18" />
            <span className="composer-tool-label">Move / resize</span>
          </button>
          <button
            aria-label="Crop component"
            title="Crop"
            aria-pressed={crop}
            disabled={!c.part}
            onClick={() => setCrop(true)}
          >
            <Icon name="cut" width="18" height="18" />
            <span className="composer-tool-label">Crop</span>
          </button>
        </div>
        <button
          className="composer-guides"
          aria-label="Composition guides"
          title="Guides"
          aria-pressed={guides}
          onClick={() => setGuides(!guides)}
        >
          <Icon name="guides" width="18" height="18" />
        </button>
        <button
          className="composer-preview-button"
          aria-label="Preview composition in text"
          title="Text preview"
          disabled={disabled || !e.fontReady}
          onClick={() => setSheet("preview")}
        >
          <Icon name="preview" width="18" height="18" />
          <span className="composer-tool-label">Preview</span>
        </button>
        {compact && (
          <button
            className="composer-settings"
            aria-label="Component settings"
            title="Component settings"
            onClick={() => setSheet("settings")}
          >
            <Icon name="settings" width="20" height="20" />
          </button>
        )}
      </div>
      <main
        className="composer-workspace"
        aria-label="Radical and stroke composer"
      >
        {!compact && (
          <aside className="composer-picker-panel">
            <ComponentPicker editor={e} onAdd={add} />
          </aside>
        )}
        <section className="composer-stage" aria-label="Arrange components">
          <CompositionCanvas composer={c} crop={crop} guides={guides} />
        </section>
        {!compact && (
          <aside className="composer-inspector-panel">{inspector}</aside>
        )}
      </main>
      <div className="composer-bottom">
        <div className="composer-layers" role="group" aria-label="Components">
          {c.document.parts.map((part, i) => (
            <button
              key={part.id}
              aria-label={`Select ${part.label} ${i + 1}`}
              aria-pressed={part.id === c.selected}
              onClick={() => c.select(part.id)}
            >
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                <path d={part.path} />
              </svg>
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      {sheet === "library" && (
        <LibraryDialog
          editor={e}
          busy={busy || c.gesturing}
          current={c.document.libraryId}
          onOpen={(entry) => void open(entry)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet !== "library" && (
        <ComposerDialog
          id="compositionSheet"
          className={sheet === "add" ? "component-picker-dialog" : ""}
          title={titles[sheet]}
          compact={compact}
          onClose={() => setSheet(null)}
        >
          {sheet === "add" && <ComponentPicker editor={e} onAdd={add} />}
          {sheet === "settings" && inspector}
          {sheet === "preview" && (
            <CompositionPreview
              composition={c.document}
              getOutline={e.getCharacterOutline}
            />
          )}
        </ComposerDialog>
      )}
    </div>
  );
}
