import type { Editor } from "../../hooks/useEditor";
import { Icon } from "../Icon";
import { HistoryControls } from "../HistoryControls";
import { CharacterForm } from "../CharacterForm";
import { ImportButton } from "../ImportButton";

type Props = {
  editor: Editor;
  onLibrary: () => void;
};
export function MobileTopBar({ editor: e, onLibrary }: Props) {
  return (
    <div className="phone-topbar" role="toolbar" aria-label="Editor actions">
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
      <div className="phone-file-actions">
        <button aria-label="Open library" title="Library" onClick={onLibrary}>
          <Icon name="library" />
        </button>
        <button
          aria-label="Save to library"
          title="Save"
          disabled={e.disabled}
          onClick={e.saveGlyph}
        >
          <Icon name="save" />
        </button>
        <ImportButton
          id="phoneImportFile"
          disabled={e.busy}
          onImport={e.importFile}
        />
      </div>
    </div>
  );
}
