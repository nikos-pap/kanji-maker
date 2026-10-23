import { useEffect, useState } from "react";
import type { Camera } from "../types";
import { zoomCamera } from "../lib/viewport";

export function useCanvasView(session: number) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const fit = () => setCamera({ x: 0, y: 0, zoom: 1 });
  useEffect(() => setCamera({ x: 0, y: 0, zoom: 1 }), [session]);
  function zoomTo(value: number) {
    setCamera((current) => zoomCamera(current, value));
  }
  return { camera, setCamera, zoomTo, fit };
}
