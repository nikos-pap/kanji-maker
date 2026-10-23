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
  const [tab, setTab] = useState<"radicals" | "strokes">("radicals");
  const [search, setSearch] = useState(""),
    [character, setCharacter] = useState("");
  const entries = useMemo(
    () =>
      RADICALS.map((radical) => {
        const { character: label } = radical;
        try {
          return {
            label,
            ...radical,
            source: {
              kind: "radical" as const,
              label,
              ...e.getCharacterOutline(label),
            },
          };
        } catch {
          return { ...radical, label, source: null };
        }
      }),
    [e.fontReady, e.getCharacterOutline],
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
      <div
        className="component-tabs"
        role="tablist"
        aria-label="Component type"
      >
        {(["radicals", "strokes"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            id={`tab-${value}`}
            aria-controls={`panel-${value}`}
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "radicals" ? "Radicals" : "Strokes"}
          </button>
        ))}
      </div>
      {tab === "radicals" ? (
        <div role="tabpanel" id="panel-radicals" aria-labelledby="tab-radicals">
          <label className="composer-search">
            <span>Find a radical</span>
            <input
              type="search"
              placeholder="木, water…"
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
          {Array.from({ length: 17 }, (_, i) => i + 1).map((strokes) => {
            const found = entries.filter(
              (entry) =>
                entry.strokes === strokes &&
                `${entry.label} ${entry.meaning} ${entry.number ?? ""}`.includes(
                  search.trim().toLowerCase(),
                ),
            );
            if (!found.length) return null;
            return (
              <div
                className="radical-group"
                key={strokes}
                role="group"
                aria-label={`${strokes} ${strokes === 1 ? "stroke" : "strokes"}`}
              >
                <h3>
                  {strokes} {strokes === 1 ? "stroke" : "strokes"}
                </h3>
                <div className="radical-grid">
                  {found.map((entry) => (
                    <button
                      key={entry.label}
                      title={`${entry.label} · ${entry.meaning}${entry.number ? ` · #${entry.number}` : " · variant"}${!entry.source ? " (not available in this font)" : ""}`}
                      aria-label={`Add ${entry.label} radical`}
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
      ) : (
        <div
          role="tabpanel"
          id="panel-strokes"
          aria-labelledby="tab-strokes"
          className="stroke-grid"
        >
          {STROKES.map((stroke) => (
            <button
              key={stroke.label}
              aria-label={`Add ${stroke.label.toLowerCase()} stroke`}
              onClick={() => onAdd({ kind: "stroke", ...stroke })}
            >
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                <path d={stroke.path} />
              </svg>
              <span>{stroke.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
