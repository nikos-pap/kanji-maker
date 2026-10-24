import { clamp } from "../lib/geometry";
import { tools } from "../lib/tools";
import type { Editor } from "../hooks/useEditor";
import { Icon } from "./Icon";

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
>;
type Props = {
  editor: ToolbarState;
  onPreview: () => void;
};
export function EditorToolbar({ editor: e, onPreview }: Props) {
  const brushDisabled = !["erase", "draw", "line"].includes(e.tool) || e.busy;
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="tool-group" role="group" aria-label="Drawing tool">
        {tools.map((t) => (
          <button
            key={t.value}
            type="button"
            data-tool={t.value}
            aria-label={t.label}
            aria-pressed={e.tool === t.value}
            title={`${t.hint} (${t.key})`}
            disabled={e.busy}
            onClick={() => e.selectTool(t.value)}
          >
            <Icon name={t.value} width="20" height="20" />
            <span className="desktop-tool-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="tool-options" role="group" aria-label="Tool settings">
        <div className="brush-shapes" role="group" aria-label="Brush shape">
          {(["round", "square"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              data-brush-shape={shape}
              aria-label={shape === "round" ? "Round brush" : "Square brush"}
              aria-pressed={e.brushShape === shape}
              disabled={e.busy}
              title={`${shape === "round" ? "Round" : "Square"} brush for Draw, Erase and Line`}
              onClick={() => e.setBrushShape(shape)}
            >
              <Icon name={shape} width="18" height="18" />
            </button>
          ))}
        </div>
        <label className="size-control">
          <span className="desktop-control-label">Size</span>
          <input
            id="brushSize"
            type="range"
            min="1"
            max="160"
            step="0.5"
            aria-label="Brush size"
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
        <button
          aria-label="Reset brush size to 45"
          title="Reset brush size to 45"
          disabled={brushDisabled}
          onClick={() => e.setBrush(45)}
        >
          <Icon name="undo" width="18" height="18" />
        </button>
        <label className="guides-control">
          <input
            id="showGrid"
            type="checkbox"
            checked={e.guides}
            onChange={(event) => e.setGuides(event.currentTarget.checked)}
          />
          Guides
        </label>
        <button
          id="previewCharacter"
          aria-label="Preview character"
          title="Preview character"
          disabled={e.busy}
          onClick={onPreview}
        >
          <Icon name="preview" width="20" height="20" />
          <span className="desktop-tool-label">Preview</span>
        </button>
      </div>
    </div>
  );
}
