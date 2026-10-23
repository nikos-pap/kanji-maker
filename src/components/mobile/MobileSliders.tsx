import type { Editor } from "../../hooks/useEditor";
import { Icon } from "../Icon";

type Props = {
  editor: Editor;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
};
export function MobileSliders({ editor: e, zoom, onZoom, onFit }: Props) {
  const brushDisabled = e.busy || !["draw", "erase", "line"].includes(e.tool);
  return (
    <>
      <label
        className={`phone-brush-slider${brushDisabled ? " is-disabled" : ""}`}
        title="Brush size"
      >
        <Icon name={e.brushShape} width="14" height="14" />
        <input
          type="range"
          aria-label="Brush size"
          min="1"
          max="160"
          step="0.5"
          value={e.brush}
          disabled={brushDisabled}
          onChange={(event) => e.setBrush(Number(event.currentTarget.value))}
        />
        <output>{e.brush}</output>
      </label>
      <div className="phone-bottom-controls">
        <button
          className="phone-guides"
          aria-label="Guides"
          title="Guides"
          aria-pressed={e.guides}
          onClick={() => e.setGuides(!e.guides)}
        >
          <Icon name="guides" width="18" height="18" />
        </button>
        <div
          className="phone-zoom-slider"
          role="group"
          aria-label="Canvas zoom"
        >
          <Icon name="zoom" width="15" height="15" />
          <input
            type="range"
            aria-label="Zoom"
            min="0"
            max="4"
            step="0.01"
            value={Math.log2(zoom)}
            disabled={e.busy}
            onChange={(event) => onZoom(2 ** Number(event.currentTarget.value))}
          />
          <output>{Math.round(zoom * 100)}%</output>
          <button
            aria-label="Fit canvas"
            title="Fit"
            disabled={e.busy}
            onClick={onFit}
          >
            <Icon name="fit" width="16" height="16" />
          </button>
        </div>
      </div>
    </>
  );
}
