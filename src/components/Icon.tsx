import type { SVGProps } from "react";

export type IconName =
  | "draw"
  | "erase"
  | "cut"
  | "line"
  | "pan"
  | "points"
  | "round"
  | "square"
  | "undo"
  | "redo"
  | "save"
  | "import"
  | "export"
  | "close"
  | "fit"
  | "guides"
  | "zoom"
  | "chevron";
const paths: Record<Exclude<IconName, "round" | "square">, string> = {
  draw: "m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-3L4 16v4Z",
  erase:
    "m13 4 7 7a2 2 0 0 1 0 3l-6 6H8l-5-5a2 2 0 0 1 0-3l7-8a2 2 0 0 1 3 0ZM7 8l9 9M8 20h13",
  cut: "M7 3v14h14M3 7h14v14M4 4l1 1m14 14 1 1",
  line: "M5 19 19 5M3 17l4 4M17 3l4 4",
  pan: "M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 5-2 7-6 7h-2c-2 0-3-1-4-3l-4-5a1.6 1.6 0 0 1 2-2l2 2",
  points:
    "M4 17c4-13 12-13 16 0M4 17V5m16 12V5M2 3h4v4H2ZM18 3h4v4h-4ZM2 15h4v4H2ZM18 15h4v4h-4Z",
  undo: "M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12",
  redo: "m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12",
  save: "M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8",
  import: "M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7",
  export: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
  close: "m6 6 12 12M6 18 18 6",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  guides: "M12 3v18M3 12h18M4 4h16v16H4Z",
  zoom: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  chevron: "m8 10 4 4 4-4",
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {name === "round" ? (
        <circle cx="12" cy="12" r="8" />
      ) : name === "square" ? (
        <rect x="4" y="4" width="16" height="16" rx="1" />
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
