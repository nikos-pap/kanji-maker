import type { Editor } from "../hooks/useEditor";
import { HistoryControls } from "./HistoryControls";
import { CharacterForm } from "./CharacterForm";
import { ImportButton } from "./ImportButton";
import { Icon } from "./Icon";

export function AppHeader({
  editor: e,
  onHelp,
  onLibrary,
}: {
  editor: Editor;
  onHelp: () => void;
  onLibrary: () => void;
}) {
  return (
    <header className="desktop-header">
      <a
        href="#compose"
        className="desktop-compose-link"
        aria-label="Radicals & strokes"
        title="Radicals & strokes"
      >
        <Icon name="compose" />
        <span>Radicals &amp; strokes</span>
      </a>
      <h1>Kanji Maker</h1>
      <CharacterForm editor={e} compact />
      <HistoryControls
        canUndo={!!e.past.length}
        canRedo={!!e.future.length}
        canClear={!e.isBlank}
        disabled={e.busy}
        onUndo={e.undo}
        onRedo={e.redo}
        onClear={e.clear}
      />
      <nav className="desktop-header-actions" aria-label="Editor actions">
        <button aria-label="Library" title="Library" onClick={onLibrary}>
          <Icon name="library" />
          <span>Library</span>
        </button>
        <button
          id="saveGlyph"
          aria-label="Save to library"
          title="Save to library"
          className="primary"
          disabled={e.disabled}
          onClick={e.saveGlyph}
        >
          <Icon name="save" />
          <span>Save</span>
        </button>
        <ImportButton
          id="projectFile"
          disabled={e.busy}
          onImport={e.importFile}
        />
        <button
          id="help"
          className="quiet"
          aria-label="Help"
          title="Help"
          onClick={onHelp}
        >
          <Icon name="help" />
        </button>
      </nav>
    </header>
  );
}
