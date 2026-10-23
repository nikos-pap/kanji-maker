import { clamp } from "../lib/geometry";
import { tools } from "../lib/tools";
import type { Editor } from "../hooks/useEditor";
import { ZoomControls } from "./ZoomControls";

type ToolbarState = Pick<
  Editor,
  | "busy"
  | "tool"
  | "selectTool"
  | "brush"
  | "setBrush"
  | "brushShape"
  | "setBrushShape"
  | "guides"
  | "setGuides"
  | "past"
  | "future"
  | "undo"
  | "redo"
  | "edited"
  | "reset"
>;
type Props = {
  editor: ToolbarState;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
};
export function EditorToolbar({ editor: e, zoom, onZoom, onFit }: Props) {
  const brushDisabled = !["erase", "draw", "line"].includes(e.tool) || e.busy;
  return (
    <div className="editor-toolbar">
      <div className="tools-row">
        <div className="tool-group" role="group" aria-label="Drawing tool">
          {tools.map((t) => (
            <button
              key={t.value}
              type="button"
              data-tool={t.value}
              aria-pressed={e.tool === t.value}
              title={`${t.hint} (${t.key})`}
              disabled={e.busy}
              onClick={() => e.selectTool(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          className="history-controls"
          role="group"
          aria-label="Edit history"
        >
          <button
            id="undo"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!e.past.length || e.busy}
            onClick={e.undo}
          >
            ↶
          </button>
          <button
            id="redo"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!e.future.length || e.busy}
            onClick={e.redo}
          >
            ↷
          </button>
          <button
            id="reset"
            className="quiet"
            disabled={!e.edited || e.busy}
            onClick={e.reset}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="tool-options" role="group" aria-label="Tool settings">
        <div className="brush-shapes" role="group" aria-label="Brush shape">
          {(["round", "square"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              data-brush-shape={shape}
              aria-pressed={e.brushShape === shape}
              disabled={e.busy}
              title={`${shape === "round" ? "Round" : "Square"} brush for Draw, Erase and Line`}
              onClick={() => e.setBrushShape(shape)}
            >
              {shape === "round" ? "Round" : "Square"}
            </button>
          ))}
        </div>
        <label className="size-control">
          Size
          <input
            id="brushSize"
            type="range"
            min="1"
            max="160"
            value={e.brush}
            disabled={brushDisabled}
            onChange={(event) => e.setBrush(Number(event.currentTarget.value))}
          />
          <input
            id="brushValue"
            type="number"
            min="1"
            max="160"
            step="0.5"
            value={e.brush}
            disabled={brushDisabled}
            aria-label="Exact brush size"
            onChange={(event) =>
              e.setBrush(
                Number.isFinite(event.currentTarget.valueAsNumber)
                  ? clamp(event.currentTarget.valueAsNumber, 1, 160)
                  : 45,
              )
            }
          />
        </label>
        <label className="guides-control">
          <input
            id="showGrid"
            type="checkbox"
            checked={e.guides}
            onChange={(event) => e.setGuides(event.currentTarget.checked)}
          />
          Guides
        </label>
        <ZoomControls
          zoom={zoom}
          onZoom={onZoom}
          onFit={onFit}
          disabled={e.busy}
        />
      </div>
    </div>
  );
}
