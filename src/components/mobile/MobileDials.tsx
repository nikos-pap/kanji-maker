import type { Editor } from "../../hooks/useEditor";
import { Icon } from "../Icon";
import { ArcDial } from "./ArcDial";

type Props = {
  editor: Editor;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
};
export function MobileDials({ editor: e, zoom, onZoom, onFit }: Props) {
  return (
    <>
      <div className="phone-view-actions">
        <button
          aria-label="Guides"
          title="Guides"
          aria-pressed={e.guides}
          onClick={() => e.setGuides(!e.guides)}
        >
          <Icon name="guides" width="18" height="18" />
        </button>
        <button
          aria-label="Fit canvas"
          title="Fit"
          disabled={e.busy}
          onClick={onFit}
        >
          <Icon name="fit" width="18" height="18" />
        </button>
      </div>
      <div className="phone-dials">
        <ArcDial
          label="Brush size"
          icon={e.brushShape}
          min={1}
          max={160}
          step={0.5}
          value={e.brush}
          valueText={String(e.brush)}
          disabled={e.busy || !["draw", "erase", "line"].includes(e.tool)}
          onChange={e.setBrush}
        />
        <ArcDial
          label="Zoom"
          icon="zoom"
          min={0}
          max={4}
          step={0.01}
          value={Math.log2(zoom)}
          valueText={`${Math.round(zoom * 100)}%`}
          disabled={e.busy}
          onChange={(value) => onZoom(2 ** value)}
        />
      </div>
    </>
  );
}
