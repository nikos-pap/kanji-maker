import { useEffect, useState } from "react";
import type { Camera } from "../types";
import { boundedCamera, zoomCamera } from "../lib/viewport";

export function useCanvasView(session: number, bounded = false) {
  const [stored, updateCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [bounds, setBounds] = useState({ width: 620, height: 620 });
  const constrain = (next: Camera) =>
    bounded ? boundedCamera(next, bounds) : next;
  const camera = constrain(stored);
  const setCamera = (next: Camera) => updateCamera(constrain(next));
  const fit = () => setCamera({ x: 0, y: 0, zoom: 1 });
  useEffect(() => setCamera({ x: 0, y: 0, zoom: 1 }), [session]);
  function zoomTo(value: number) {
    updateCamera((current) =>
      constrain(
        zoomCamera(constrain(current), value, undefined, bounded ? 0.25 : 1),
      ),
    );
  }
  return { camera, setCamera, zoomTo, fit, setBounds };
}
