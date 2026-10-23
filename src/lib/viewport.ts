import type { Camera, Point } from "../types";
import { clamp } from "./geometry";

export interface ViewportSize {
  width: number;
  height: number;
  /** Fit and movement reference only; rendering still covers the whole viewport. */
  fit?: { x: number; y: number; width: number; height: number };
}
export interface PinchState {
  zoom: number;
  distance: number;
  anchor: Point;
}
/** Pan ranges open continuously as each axis outgrows the fit area. */
export function boundedCamera(camera: Camera, bounds: ViewportSize): Camera {
  const zoom = clamp(camera.zoom, 0.25, 16);
  const view = canvasViewport({ ...camera, zoom }, bounds);
  const area = bounds.fit || bounds;
  const center = 500 - 500 / zoom;
  const horizontal = Math.max(0, 1000 - area.width * view.unit) / 2;
  const vertical = Math.max(0, 1000 - area.height * view.unit) / 2;
  return {
    zoom,
    x: clamp(camera.x, center - horizontal, center + horizontal),
    y: clamp(camera.y, center - vertical, center + vertical),
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

/** Rebase each step on the visible result so blocked movement cannot accumulate. */
export function advancePinch(
  previous: PinchState,
  bounds: ViewportSize,
  distance: number,
  fraction: Point,
  bounded = false,
) {
  const nextDistance = Math.max(1, distance);
  const zoom = clamp(
    (previous.zoom * nextDistance) / previous.distance,
    bounded ? 0.25 : 1,
    16,
  );
  const requested = anchoredCamera(zoom, bounds, previous.anchor, fraction);
  const camera = bounded ? boundedCamera(requested, bounds) : requested;
  const view = canvasViewport(camera, bounds);
  return {
    camera,
    pinch: {
      zoom,
      distance: nextDistance,
      anchor: [
        view.x + fraction[0] * view.width,
        view.y + fraction[1] * view.height,
      ] as Point,
    },
  };
}
