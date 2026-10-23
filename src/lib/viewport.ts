import type { Camera, Point } from "../types";
import { clamp } from "./geometry";

export interface ViewportSize {
  width: number;
  height: number;
  /** Fit and movement reference only; rendering still covers the whole viewport. */
  fit?: { x: number; y: number; width: number; height: number };
}
/** Keep fitting axes centered; inward-moving edges stop at the original 100% box. */
export function boundedCamera(camera: Camera, bounds: ViewportSize): Camera {
  const zoom = clamp(camera.zoom, 0.25, 16);
  const view = canvasViewport({ ...camera, zoom }, bounds);
  const area = bounds.fit || bounds;
  const center = 500 - 500 / zoom;
  const limit = Math.max(0, 1000 - 1000 / zoom);
  return {
    zoom,
    x: area.width * view.unit >= 1000 ? center : clamp(camera.x, 0, limit),
    y: area.height * view.unit >= 1000 ? center : clamp(camera.y, 0, limit),
  };
}
/** The camera describes a square reference; the viewport expands to the actual surface. */
export function canvasViewport(camera: Camera, bounds: ViewportSize) {
  const width = Math.max(1, bounds.width),
    height = Math.max(1, bounds.height);
  const area = bounds.fit || { x: 0, y: 0, width, height };
  const unit =
    1000 / (Math.max(1, Math.min(area.width, area.height)) * camera.zoom);
  return {
    x: camera.x + 500 / camera.zoom - (area.x + area.width / 2) * unit,
    y: camera.y + 500 / camera.zoom - (area.y + area.height / 2) * unit,
    width: width * unit,
    height: height * unit,
    unit,
  };
}
export function zoomCamera(
  camera: Camera,
  value: number,
  anchor?: Point,
  minimum = 1,
): Camera {
  const zoom = clamp(value, minimum, 16),
    focus = anchor || [
      camera.x + 500 / camera.zoom,
      camera.y + 500 / camera.zoom,
    ];
  const ratio = camera.zoom / zoom;
  return {
    zoom,
    x: focus[0] + (camera.x - focus[0]) * ratio,
    y: focus[1] + (camera.y - focus[1]) * ratio,
  };
}
export function anchoredCamera(
  zoom: number,
  bounds: ViewportSize,
  anchor: Point,
  fraction: Point,
): Camera {
  const view = canvasViewport({ x: 0, y: 0, zoom }, bounds);
  return {
    zoom,
    x: anchor[0] - fraction[0] * view.width - view.x,
    y: anchor[1] - fraction[1] * view.height - view.y,
  };
}
