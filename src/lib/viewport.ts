import type { Camera, Point } from "../types";
import { clamp } from "./geometry";

export interface ViewportSize {
  width: number;
  height: number;
}
/** The camera describes a square reference; the viewport expands to the actual surface. */
export function canvasViewport(camera: Camera, bounds: ViewportSize) {
  const width = Math.max(1, bounds.width),
    height = Math.max(1, bounds.height);
  const unit = 1000 / (Math.min(width, height) * camera.zoom);
  return {
    x: camera.x + 500 / camera.zoom - (width * unit) / 2,
    y: camera.y + 500 / camera.zoom - (height * unit) / 2,
    width: width * unit,
    height: height * unit,
    unit,
  };
}
export function zoomCamera(
  camera: Camera,
  value: number,
  anchor?: Point,
): Camera {
  const zoom = clamp(value, 1, 16),
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
    x: anchor[0] + (0.5 - fraction[0]) * view.width - 500 / zoom,
    y: anchor[1] + (0.5 - fraction[1]) * view.height - 500 / zoom,
  };
}
