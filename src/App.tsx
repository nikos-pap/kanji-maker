import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { EditorCanvas } from "./components/EditorCanvas";
import { Glyph } from "./components/Glyph";
import { clamp } from "./lib/geometry";
import { useEditor } from "./hooks/useEditor";
import type { Editor } from "./hooks/useEditor";
import type { Tool } from "./types";

const tools: { value: Tool; label: string; icon: string; key: string }[] = [
  { value: "points", label: "Points", icon: "◇", key: "N" },
  { value: "erase", label: "Erase", icon: "▱", key: "E" },
  { value: "cut", label: "Cut area", icon: "▧", key: "R" },
  { value: "polygon", label: "Polygon cut", icon: "⬠", key: "P" },
  { value: "draw", label: "Draw", icon: "╱", key: "D" },
  { value: "line", label: "Line", icon: "↗", key: "L" },
  { value: "pan", label: "Pan", icon: "✥", key: "H" },
];

function Toolbar({ editor: e }: { editor: Editor }) {
  const fontInput = useRef<HTMLInputElement>(null),
    brushDisabled = !["erase", "draw", "line"].includes(e.tool) || e.busy;
  return (
    <>
      <form
        id="characterForm"
        className="character-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void e.loadCharacter();
        }}
      >
        <label htmlFor="character">Start with a character</label>
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
          Load character
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
        <span id="fontName">{e.fontLabel}</span>
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
      <div className="editor-toolbar">
        <div className="tool-group" role="group" aria-label="Drawing tool">
          {tools.map((t) => (
            <button
              key={t.value}
              type="button"
              data-tool={t.value}
              aria-pressed={e.tool === t.value}
              title={`${t.label} (${t.key})`}
              disabled={e.busy}
              onClick={() => e.selectTool(t.value)}
            >
              <span className="tool-icon" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <label className="size-control">
          Size{" "}
          <input
            id="brushSize"
            type="range"
            min="1"
            max="160"
            value={e.brush}
            disabled={brushDisabled}
            onChange={(event) => e.setBrush(Number(event.currentTarget.value))}
          />
          <input
            id="brushValue"
            type="number"
            min="1"
            max="160"
            step="0.5"
            value={e.brush}
            disabled={brushDisabled}
            aria-label="Exact brush size"
            onChange={(event) =>
              e.setBrush(
                Number.isFinite(event.currentTarget.valueAsNumber)
                  ? clamp(event.currentTarget.valueAsNumber, 1, 160)
                  : 45,
              )
            }
          />
        </label>
        <div className="history-controls">
          <button
            id="undo"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!e.past.length || e.busy}
            onClick={e.undo}
          >
            ↶
          </button>
          <button
            id="redo"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!e.future.length || e.busy}
            onClick={e.redo}
          >
            ↷
          </button>
          <button
            id="reset"
            className="quiet"
            disabled={!e.edited || e.busy}
            onClick={e.reset}
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}

function ExportPanel({ editor: e }: { editor: Editor }) {
  const copyDisabled = e.disabled || (e.copyMode === "text" && !e.currentEntry);
  return (
    <section className="export-panel">
      <h2>Current character</h2>
      <label htmlFor="glyphName">Name</label>
      <input
        id="glyphName"
        value={e.model.name}
        maxLength={80}
        autoComplete="off"
        disabled={e.busy}
        onChange={(event) =>
          e.changeModel({ ...e.model, name: event.currentTarget.value })
        }
      />
      <button
        id="saveGlyph"
        className="primary full"
        disabled={e.disabled}
        onClick={e.saveGlyph}
      >
        Save to library
      </button>
      <div className="export-buttons">
        <button
          id="exportSvg"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("svg")}
        >
          SVG
        </button>
        <button
          id="exportPng"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("png")}
        >
          PNG
        </button>
        <button
          id="exportFont"
          title="Single-character font at U+E000"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("font")}
        >
          Font
        </button>
        <button
          id="exportCharacterProject"
          disabled={e.disabled}
          onClick={() => e.exportCurrent("json")}
        >
          App file
        </button>
      </div>
      <button
        id="copyCharacter"
        className="text-button"
        onClick={() => void e.copyCharacter()}
      >
        Copy single-font character
      </button>
      <div className="copy-document">
        <label htmlFor="copyDocumentMode">Paste into another document</label>
        <select
          id="copyDocumentMode"
          value={e.copyMode}
          onChange={(event) =>
            e.setCopyMode(event.currentTarget.value as "text" | "image")
          }
        >
          <option value="text">Editable text · library font</option>
          <option value="image">Transparent image</option>
        </select>
        <button
          id="copyDocument"
          className="full"
          disabled={copyDisabled}
          onClick={() => void e.copyForDocument()}
        >
          Copy for document
        </button>
        <p id="copyDocumentHint" className="small">
          {e.copyMode === "image"
            ? "Copies a transparent picture that can be pasted without installing a font."
            : e.currentEntry
              ? `Copies editable text using ${e.family}. Install the library font in Word and keep source formatting when pasting.`
              : "Save the current version to your library to copy editable text. Image copies work immediately."}
        </p>
      </div>
    </section>
  );
}

function LibraryPanel({ editor: e }: { editor: Editor }) {
  const projectInput = useRef<HTMLInputElement>(null);
  return (
    <section className="library-panel">
      <div className="section-heading">
        <h2>Your library</h2>
        <button
          id="importProject"
          className="text-button"
          disabled={e.busy}
          onClick={() => projectInput.current?.click()}
        >
          Import app file
        </button>
      </div>
      <div id="library">
        {!e.library.length && (
          <div className="library-empty">
            Your saved characters will appear here.
          </div>
        )}
        {e.library.map((item) => (
          <div className="library-item" key={item.id}>
            <button
              className="library-load"
              title={`Edit ${item.model.name}`}
              disabled={e.busy}
              onClick={() => void e.openGlyph(item)}
            >
              <Glyph model={item.model} prefix={`library-${item.id}`} />
              <span className="library-label">
                <span>{item.model.name || "Untitled"}</span>
                <small>U+{item.codePoint.toString(16).toUpperCase()}</small>
              </span>
            </button>
            <button
              className="library-copy"
              title={`Copy ${item.model.name} for another document`}
              aria-label={`Copy ${item.model.name} for another document`}
              disabled={e.busy}
              onClick={() => void e.copyForDocument(item)}
            >
              ⧉
            </button>
            <button
              className="library-delete"
              aria-label={`Delete ${item.model.name}`}
              disabled={e.busy}
              onClick={() => void e.removeGlyph(item)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="library-exports">
        <button
          id="exportLibraryWord"
          className="primary full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("word")}
        >
          Word document (.docx)
        </button>
        <button
          id="exportLibraryFont"
          className="full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("font")}
        >
          Library font (.ttf)
        </button>
        <button
          id="exportProject"
          className="quiet full"
          disabled={!e.library.length || e.busy}
          onClick={() => e.exportLibrary("json")}
        >
          App file (.json)
        </button>
      </div>
      <p className="small">
        Exports include all saved characters. App files preserve editable
        outlines and character codes.
      </p>
      <p id="libraryFontName" className="small">
        Font: {e.family}
      </p>
      <input
        ref={projectInput}
        type="file"
        id="projectFile"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void e.importFile(file);
        }}
      />
    </section>
  );
}

function Modal({
  children,
  onDismiss,
  id,
}: {
  children: ReactNode;
  onDismiss: () => void;
  id: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      id={id}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
function Help({ close }: { close: () => void }) {
  return (
    <Modal id="helpDialog" onDismiss={close}>
      <h2>A few simple tools</h2>
      <p>
        Enter a character and load it. Erase removes parts of its shape; Cut
        area removes a rectangle. Draw and Line add strokes. Use Undo whenever
        you need it.
      </p>
      <p>
        Scroll over the canvas to zoom around the pointer. Hold Space and drag,
        use the middle mouse button, or choose Pan. Fit shows the whole
        character. Pinch with two fingers on a touch screen.
      </p>
      <p>
        Points edits the original font outline. Squares are outline points;
        circles are curve handles. Drag to reshape, enter X/Y coordinates, or
        nudge with arrows (Shift: 10 units, Alt: 0.1). Shift constrains dragging
        horizontally or vertically. Drag a highlighted outline to move its
        connected shape.
      </p>
      <p>
        Polygon cut removes an area with straight edges. Click corners, then
        Apply cut, Enter, or double-click. Escape cancels an unfinished cut or
        drag. Shift snaps line angles.
      </p>
      <p>
        Shortcuts: N/E/R/P/D/L/H select tools, 0 fits, Ctrl+Z undoes,
        Ctrl+Shift+Z redoes.
      </p>
      <p>
        Save characters to your library, then export a Word document with its
        font embedded, a reusable font, or an editable app file. Saved codes
        stay stable. Importing into an empty library restores the original font
        identity and codes; importing into an existing library adds copies with
        fresh codes.
      </p>
      <p>
        Copy for document copies editable text or a transparent image. Text
        needs the library font installed in the receiving app; keep source
        formatting. Update the installed font after changing your library.
        Images need no custom font. The single-character font uses U+E000.
      </p>
      <p id="fontCredit">
        The included font is derived from Noto Serif CJK under the SIL Open Font
        License. Its licence is included with font exports. SVG keeps source
        curves and transparent cuts; fonts preserve quadratic outlines and trace
        composed cuts and strokes.
      </p>
      <button className="primary" onClick={close}>
        Got it
      </button>
    </Modal>
  );
}

export default function App() {
  const e = useEditor();
  return (
    <>
      <header>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            字
          </span>
          <div>
            <h1>Kanji Maker</h1>
            <p>Make a character of your own.</p>
          </div>
        </div>
        <button id="help" className="quiet" onClick={() => e.setHelp(true)}>
          How it works
        </button>
      </header>
      <main>
        <section className="workspace" aria-label="Character editor">
          <Toolbar editor={e} />
          <EditorCanvas
            key={e.session}
            model={e.model}
            tool={e.tool}
            brush={e.brush}
            busy={e.busy}
            onChange={e.changeModel}
            onCommit={e.remember}
            onPending={e.setPending}
            onGesture={e.onGesture}
            notify={e.notify}
          />
        </section>
        <aside>
          <section className="preview-panel">
            <h2>In text</h2>
            <div
              id="textPreview"
              className="text-preview"
              aria-label="Custom character preview"
            >
              あ<Glyph model={e.model} prefix="preview" />い
            </div>
            <p className="small">Your character at reading size.</p>
          </section>
          <ExportPanel editor={e} />
          <LibraryPanel editor={e} />
        </aside>
      </main>
      <div
        id="status"
        role="status"
        aria-live="polite"
        className={e.message.error ? "error" : ""}
      >
        {e.message.text}
      </div>
      {e.help && <Help close={() => e.setHelp(false)} />}
      {e.confirmation && (
        <Modal id="confirmDialog" onDismiss={() => e.answerConfirmation(false)}>
          <h2>{e.confirmation.title}</h2>
          <p>{e.confirmation.text}</p>
          <div className="dialog-actions">
            <button onClick={() => e.answerConfirmation(false)}>Cancel</button>
            <button
              className="primary"
              onClick={() => e.answerConfirmation(true)}
            >
              Continue
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
