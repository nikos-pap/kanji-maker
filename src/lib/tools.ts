import type { Tool } from "../types";

export const tools: {
  value: Tool;
  label: string;
  key: string;
  hint: string;
}[] = [
  { value: "draw", label: "Draw", key: "D", hint: "Drag to draw" },
  { value: "erase", label: "Erase", key: "E", hint: "Drag to erase" },
  {
    value: "cut",
    label: "Cut area",
    key: "R",
    hint: "Drag a rectangle to cut; Escape cancels",
  },
  {
    value: "line",
    label: "Line",
    key: "L",
    hint: "Drag a line; Shift snaps the angle",
  },
  {
    value: "points",
    label: "Points",
    key: "N",
    hint: "Drag points or outlines; arrows nudge",
  },
];
