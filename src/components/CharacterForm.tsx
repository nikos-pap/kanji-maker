import type { Editor } from "../hooks/useEditor";
import { Icon } from "./Icon";

type CharacterFormState = Pick<
  Editor,
  "busy" | "character" | "setCharacter" | "loadCharacter"
>;
export function CharacterForm({
  editor: e,
  compact = false,
}: {
  editor: CharacterFormState;
  compact?: boolean;
}) {
  return (
    <form
      id="characterForm"
      className={"character-bar" + (compact ? " compact-character" : "")}
      onSubmit={(event) => {
        event.preventDefault();
        void e.loadCharacter();
      }}
    >
      {!compact && <label htmlFor="character">Character</label>}
      <input
        id="character"
        value={e.character}
        onChange={(event) => e.setCharacter(event.currentTarget.value)}
        autoComplete="off"
        spellCheck={false}
        aria-label="Base character"
        enterKeyHint="go"
        disabled={e.busy}
      />
      <button
        id="loadCharacter"
        type="submit"
        className="primary"
        aria-label="Load character"
        title="Load character"
        disabled={e.busy}
      >
        {compact ? <Icon name="load" width="18" height="18" /> : "Load"}
      </button>
    </form>
  );
}
