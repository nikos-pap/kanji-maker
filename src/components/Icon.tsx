import type { SVGProps } from "react";

export type IconName =
  | "draw"
  | "compose"
  | "resize"
  | "preview"
  | "erase"
  | "cut"
  | "line"
  | "font"
  | "library"
  | "points"
  | "round"
  | "square"
  | "undo"
  | "redo"
  | "clear"
  | "add"
  | "settings"
  | "load"
  | "help"
  | "save"
  | "import"
  | "export"
  | "close"
  | "fit"
  | "guides"
  | "zoom"
  | "chevron";
const paths: Record<Exclude<IconName, "round" | "square">, string> = {
  help: "M12 16h.01M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  add: "M12 5v14M5 12h14",
  load: "M5 12h14m-5-5 5 5-5 5",
  settings:
    "M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M13 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM19 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  clear: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  compose: "M3 3h7v18H3ZM14 3h7v7h-7Zm0 11h7v7h-7Z",
  resize:
    "M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5M8 8 4 4m12 4 4-4M8 16l-4 4m12-4 4 4",
  preview:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  draw: "m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-3L4 16v4Z",
  erase:
    "m13 4 7 7a2 2 0 0 1 0 3l-6 6H8l-5-5a2 2 0 0 1 0-3l7-8a2 2 0 0 1 3 0ZM7 8l9 9M8 20h13",
  cut: "M7 3v14h14M3 7h14v14M4 4l1 1m14 14 1 1",
  line: "M5 19 19 5M3 17l4 4M17 3l4 4",
  font: "M4 20 12 4l8 16M7 14h10",
  library:
    "M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v16M5 8h3m-3 4h3m8-4h3m-3 4h3",
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
