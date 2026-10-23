import { useEffect, useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import { tools } from "../../lib/tools";
import { Icon } from "../Icon";

export function MobileTools({ editor: e }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const active = tools.find((t) => t.value === e.tool)!;
  return (
    <>
      {open && (
        <>
          <button
            className="phone-tool-backdrop"
            aria-label="Dismiss tools"
            onClick={() => setOpen(false)}
          />
          <div
            id="phoneToolPalette"
            className="phone-tool-palette"
            role="toolbar"
            aria-label="Tools"
          >
            {tools.map((tool) => (
              <button
                key={tool.value}
                className="phone-tool-choice"
                data-tool={tool.value}
                aria-label={tool.label}
                aria-pressed={e.tool === tool.value}
                disabled={e.busy}
                onClick={() => {
                  e.selectTool(tool.value);
                  setOpen(false);
                }}
              >
                <Icon name={tool.value} />
                <span>{tool.label}</span>
              </button>
            ))}
            <button
              className="phone-tool-choice phone-shape-choice"
              role="switch"
              aria-label="Square brush"
              aria-checked={e.brushShape === "square"}
              disabled={e.busy}
              onClick={() => {
                e.setBrushShape(e.brushShape === "round" ? "square" : "round");
                setOpen(false);
              }}
            >
              <Icon name={e.brushShape} />
              <span>
                {e.brushShape === "round" ? "Square tip" : "Round tip"}
              </span>
            </button>
          </div>
        </>
      )}
      <button
        id="phoneTools"
        className="phone-tools-toggle"
        aria-label={open ? "Close tools" : `Tools: ${active.label}`}
        aria-expanded={open}
        aria-controls="phoneToolPalette"
        title={active.label}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "close" : e.tool} width="24" height="24" />
      </button>
    </>
  );
}
