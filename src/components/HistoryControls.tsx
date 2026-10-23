import { Icon } from "./Icon";

export function HistoryControls({
  canUndo,
  canRedo,
  canClear,
  disabled,
  onUndo,
  onRedo,
  onClear,
}: {
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="history-controls" role="group" aria-label="Edit history">
      <button
        id="undo"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Icon name="undo" width="18" height="18" />
      </button>
      <button
        id="redo"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Icon name="redo" width="18" height="18" />
      </button>
      <button
        id="clear"
        aria-label="Clear"
        title="Clear canvas"
        disabled={disabled || !canClear}
        onClick={onClear}
      >
        <Icon name="clear" width="18" height="18" />
      </button>
    </div>
  );
}
