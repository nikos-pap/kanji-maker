import { useRef } from "react";
import type { Editor } from "../hooks/useEditor";

type CharacterFormState = Pick<
  Editor,
  | "busy"
  | "character"
  | "setCharacter"
  | "loadCharacter"
  | "fontLabel"
  | "chooseFont"
>;
export function CharacterForm({ editor: e }: { editor: CharacterFormState }) {
  const fontInput = useRef<HTMLInputElement>(null);
  return (
    <form
      id="characterForm"
      className="character-bar"
      onSubmit={(event) => {
        event.preventDefault();
        void e.loadCharacter();
      }}
    >
      <label htmlFor="character">Character</label>
      <input
        id="character"
        value={e.character}
        onChange={(event) => e.setCharacter(event.currentTarget.value)}
        autoComplete="off"
        spellCheck={false}
        aria-label="Base character"
      />
      <button
        id="loadCharacter"
        type="submit"
        className="primary"
        disabled={e.busy}
      >
        Load
      </button>
      <button
        id="chooseFont"
        type="button"
        className="quiet"
        disabled={e.busy}
        onClick={() => fontInput.current?.click()}
      >
        Choose font…
      </button>
      <span id="fontName" title={e.fontLabel}>
        {e.fontLabel}
      </span>
      <input
        ref={fontInput}
        type="file"
        id="fontFile"
        accept=".ttf,.otf,.woff,.woff2"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void e.chooseFont(file);
        }}
      />
    </form>
  );
}
