import { useEffect, useState } from "react";
import type { Camera } from "../types";
import { clamp } from "../lib/geometry";

export function useCanvasView(session: number) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const fit = () => setCamera({ x: 0, y: 0, zoom: 1 });
  useEffect(() => setCamera({ x: 0, y: 0, zoom: 1 }), [session]);
  function zoomTo(value: number) {
    const zoom = clamp(value, 1, 16),
      size = 1000 / zoom;
    setCamera((current) => ({
      zoom,
      x: clamp(current.x + 500 / current.zoom - size / 2, 0, 1000 - size),
      y: clamp(current.y + 500 / current.zoom - size / 2, 0, 1000 - size),
    }));
  }
  return { camera, setCamera, zoomTo, fit };
}
