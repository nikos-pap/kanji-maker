import { useRef } from "react";
import type { Editor } from "../hooks/useEditor";

type Props = { editor: Pick<Editor, "busy" | "fontLabel" | "chooseFont"> };
export function FontPicker({ editor: e }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="font-picker">
      <button
        id="chooseFont"
        type="button"
        className="quiet"
        disabled={e.busy}
        onClick={() => input.current?.click()}
      >
        Choose font…
      </button>
      <span id="fontName" title={e.fontLabel}>
        {e.fontLabel}
      </span>
      <input
        ref={input}
        id="fontFile"
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void e.chooseFont(file);
        }}
      />
    </div>
  );
}
