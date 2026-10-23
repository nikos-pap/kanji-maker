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
      <DragAdjustButton
        label="Brush size"
        icon={e.brushShape}
        min={1}
        max={160}
        step={0.5}
        sensitivity={0.5}
        value={e.brush}
        valueText={String(e.brush)}
        disabled={e.busy || !["draw", "erase", "line"].includes(e.tool)}
        onChange={e.setBrush}
        onReset={() => e.setBrush(45)}
      />
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
