import type { Editor } from "../hooks/useEditor";
import { HistoryControls } from "./HistoryControls";

export function AppHeader({
  editor: e,
  onHelp,
  onLibrary,
  onImport,
}: {
  editor: Editor;
  onHelp: () => void;
  onLibrary: () => void;
  onImport: () => void;
}) {
  return (
    <header>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          字
        </span>
        <div>
          <h1>Kanji Maker</h1>
        </div>
      </div>
      <HistoryControls
        canUndo={!!e.past.length}
        canRedo={!!e.future.length}
        canClear={!e.isBlank}
        disabled={e.busy}
        onUndo={e.undo}
        onRedo={e.redo}
        onClear={e.clear}
      />
      <nav className="app-navigation" aria-label="Editor pages">
        <a href="#compose">Radicals &amp; strokes</a>
        <button onClick={onLibrary}>Library</button>
        <button onClick={onImport}>Import</button>
        <button id="help" className="quiet" onClick={onHelp}>
          Help
        </button>
      </nav>
    </header>
  );
}
