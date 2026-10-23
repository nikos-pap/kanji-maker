import type { Editor } from "../../hooks/useEditor";
import { Icon } from "../Icon";
import { DragAdjustButton } from "./DragAdjustButton";

type Props = {
  editor: Editor;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
};
export function MobileViewControls({ editor: e, zoom, onZoom, onFit }: Props) {
  return (
    <div
      className="phone-view-actions"
      role="group"
      aria-label="Brush and view"
    >
      <button
        aria-label="Guides"
        title="Guides"
        aria-pressed={e.guides}
        onClick={() => e.setGuides(!e.guides)}
      >
        <Icon name="guides" width="20" height="20" />
      </button>
      <div
        className="phone-brush-size"
        role="group"
        aria-label="Brush size controls"
      >
        <button
          className="phone-brush-reset"
          aria-label="Reset brush size to 45"
          title="Reset brush size to 45"
          disabled={e.busy || !["draw", "erase", "line"].includes(e.tool)}
          onClick={() => e.setBrush(45)}
        >
          <Icon name={e.brushShape} width="18" height="18" />
        </button>
        <input
          aria-label="Brush size"
          type="range"
          min="1"
          max="160"
          step="0.5"
          value={e.brush}
          disabled={e.busy || !["draw", "erase", "line"].includes(e.tool)}
          onChange={(event) => e.setBrush(event.currentTarget.valueAsNumber)}
        />
        <output aria-hidden="true">{e.brush}</output>
      </div>
      <DragAdjustButton
        label="Fit canvas / Zoom"
        icon="fit"
        min={-2}
        max={4}
        step={0.01}
        sensitivity={0.01}
        value={Math.log2(zoom)}
        valueText={`${Math.round(zoom * 100)}%`}
        disabled={e.busy}
        onChange={(value) => onZoom(2 ** value)}
        onReset={onFit}
      />
    </div>
  );
}
