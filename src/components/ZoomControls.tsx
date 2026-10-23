type Props = {
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
  disabled?: boolean;
};
export function ZoomControls({ zoom, onZoom, onFit, disabled }: Props) {
  const zooms = [...new Set([1, 1.5, 2, 3, 4, 8, 16, zoom])].sort(
    (a, b) => a - b,
  );
  return (
    <div className="zoom-controls" role="group" aria-label="Canvas zoom">
      <button
        id="zoomOut"
        aria-label="Zoom out"
        disabled={disabled || zoom <= 1}
        onClick={() => onZoom(zoom / 1.5)}
      >
        −
      </button>
      <select
        id="zoomLevel"
        aria-label="Canvas zoom"
        value={zoom}
        disabled={disabled}
        onChange={(e) => onZoom(Number(e.currentTarget.value))}
      >
        {zooms.map((z) => (
          <option key={z} value={z}>
            {Math.round(z * 100)}%
          </option>
        ))}
      </select>
      <button
        id="zoomIn"
        aria-label="Zoom in"
        disabled={disabled || zoom >= 16}
        onClick={() => onZoom(zoom * 1.5)}
      >
        +
      </button>
      <button id="zoomFit" disabled={disabled} onClick={onFit}>
        Fit
      </button>
    </div>
  );
}
