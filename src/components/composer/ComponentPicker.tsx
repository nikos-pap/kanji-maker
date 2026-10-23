import { useMemo, useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import { RADICALS, STROKES } from "../../lib/componentCatalog";
import type { ComponentPart } from "../../lib/composition";

export type ComponentSource = Pick<
  ComponentPart,
  "kind" | "label" | "path" | "fontLabel" | "customFont"
>;
type Props = { editor: Editor; onAdd: (source: ComponentSource) => void };
export function ComponentPicker({ editor: e, onAdd }: Props) {
  const [search, setSearch] = useState(""),
    [character, setCharacter] = useState("");
  const entries = useMemo(() => {
    const radicals = RADICALS.map((radical) => {
      const { character: label } = radical;
      let source: ComponentSource | null = null;
      try {
        source = { kind: "radical", label, ...e.getCharacterOutline(label) };
      } catch {
        // Keep unsupported radicals visible so a different font can provide them.
      }
      return {
        label,
        strokes: radical.strokes,
        number: radical.number,
        source,
        title:
          label +
          " · " +
          radical.meaning +
          (radical.number ? " · #" + radical.number : " · variant"),
        search: (
          label +
          " " +
          radical.meaning +
          " " +
          (radical.number ?? "")
        ).toLowerCase(),
      };
    });
    return [
      ...STROKES.map((stroke) => ({
        label: stroke.label,
        strokes: 1,
        number: undefined,
        source: { kind: "stroke" as const, ...stroke },
        title: stroke.label + " · stroke",
        search: (stroke.label + " stroke").toLowerCase(),
      })),
      ...radicals,
    ];
  }, [e.fontReady, e.getCharacterOutline]);
  const filtered = entries.filter((entry) =>
    entry.search.includes(search.trim().toLowerCase()),
  );
  function addCharacter() {
    const characters = [...character.trim()];
    if (characters.length !== 1) {
      e.notify("Enter one radical or character.", true);
      return;
    }
    try {
      onAdd({
        kind: "radical",
        label: characters[0],
        ...e.getCharacterOutline(characters[0]),
      });
    } catch (error) {
      e.notify(error instanceof Error ? error.message : String(error), true);
    }
  }
  return (
    <section className="component-picker" aria-label="Add components">
      <div className="component-picker-controls">
        <label className="composer-search">
          <span>Find a component</span>
          <input
            type="search"
            placeholder="木, water, horizontal…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <form
          className="component-custom"
          onSubmit={(event) => {
            event.preventDefault();
            addCharacter();
          }}
        >
          <input
            aria-label="Custom radical or character"
            placeholder="Any character"
            maxLength={4}
            value={character}
            onChange={(event) => setCharacter(event.currentTarget.value)}
          />
          <button disabled={!e.fontReady || !character.trim()} type="submit">
            Add
          </button>
        </form>
        {!e.fontReady && <p role="status">Loading radicals…</p>}
      </div>
      <div
        className="component-catalog"
        role="region"
        aria-label="Radicals and strokes"
        tabIndex={0}
      >
        {!filtered.length && <p>No matching components</p>}
        {Array.from({ length: 17 }, (_, i) => i + 1).map((strokes) => {
          const found = filtered.filter((entry) => entry.strokes === strokes);
          if (!found.length) return null;
          return (
            <div
              className="radical-group"
              key={strokes}
              role="group"
              aria-label={strokes + (strokes === 1 ? " stroke" : " strokes")}
            >
              <h3>
                {strokes} {strokes === 1 ? "stroke" : "strokes"}
              </h3>
              <div className="radical-grid">
                {found.map((entry) => (
                  <button
                    key={(entry.source?.kind ?? "radical") + "-" + entry.label}
                    title={
                      entry.title +
                      (!entry.source ? " (not available in this font)" : "")
                    }
                    aria-label={
                      "Add " +
                      (entry.source?.kind === "stroke"
                        ? entry.label.toLowerCase() + " stroke"
                        : entry.label + " radical")
                    }
                    data-radical-number={entry.number}
                    disabled={!entry.source}
                    onClick={() => {
                      if (entry.source) onAdd(entry.source);
                    }}
                  >
                    {entry.source ? (
                      <svg viewBox="0 0 1000 1000" aria-hidden="true">
                        <path d={entry.source.path} />
                      </svg>
                    ) : (
                      <span>{entry.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
