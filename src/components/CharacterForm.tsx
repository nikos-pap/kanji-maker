import type { Editor } from "../hooks/useEditor";

type CharacterFormState = Pick<
  Editor,
  "busy" | "character" | "setCharacter" | "loadCharacter"
>;
export function CharacterForm({ editor: e }: { editor: CharacterFormState }) {
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
    </form>
  );
}
