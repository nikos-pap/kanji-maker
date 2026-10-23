import { clamp } from "./geometry";

export const dialPoint = (fraction: number) => {
  const angle = Math.PI * (1 - clamp(fraction, 0, 1));
  return { x: 60 + 44 * Math.cos(angle), y: 62 - 44 * Math.sin(angle) };
};
export function dialFraction(x: number, y: number): number {
  const angle = Math.atan2(62 - y, x - 60);
  if (angle < 0) return x < 60 ? 0 : 1;
  return clamp(1 - angle / Math.PI, 0, 1);
}
