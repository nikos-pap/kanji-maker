import { Modal } from "./Modal";

export function HelpDialog({ close }: { close: () => void }) {
  return (
    <Modal id="helpDialog" onDismiss={close}>
      <h2>A few simple tools</h2>
      <div className="help-text">
        <p>
          Enter a character and load it. Erase removes parts of its shape; Cut
          area removes a rectangle. Draw and Line add strokes. Use Undo whenever
          you need it.
        </p>
        <p>
          Scroll over the canvas to zoom around the pointer. Hold Space and drag
          or use the middle mouse button. Fit shows the whole character. Pinch
          with two fingers on a touch screen. On phones, zoom goes up to 1600%;
          inward-moving edges stop at their original 100% positions. An axis
          stays centered while the box fits. Tap Fit/Zoom to reset or drag to
          adjust. The adjacent brush button works the same way and shows the tip
          shape; tapping it resets the size to 45.
        </p>
        <p>
          Points edits the original font outline. Squares are outline points;
          circles are curve handles. Drag to reshape, enter X/Y coordinates, or
          nudge with arrows (Shift: 10 units, Alt: 0.1). Shift constrains
          dragging horizontally or vertically. Drag a highlighted outline to
          move its connected shape.
        </p>
        <p>
          Cut area shows a rectangle as you drag; release to apply. Escape
          cancels a drag. Round and Square choose the brush tip shared by Draw,
          Erase and Line. Size controls its width. Shift snaps line angles.
        </p>
        <p>
          Shortcuts: D/E/R/L/N select tools, 0 fits, Ctrl+Z undoes, Ctrl+Shift+Z
          redoes.
        </p>
        <p>
          Save characters to your library, then export a Word document with its
          font embedded, a reusable font, or an editable app file. Saved codes
          stay stable. Importing into an empty library restores the original
          font identity and codes; importing into an existing library adds
          copies with fresh codes.
        </p>
        <p>
          Copy for document copies editable text or a transparent image. Text
          needs the library font installed in the receiving app; keep source
          formatting. Update the installed font after changing your library.
          Images need no custom font. The single-character font uses U+E000.
        </p>
        <p id="fontCredit">
          The included font is derived from Noto Serif CJK under the SIL Open
          Font License. Its licence is included with font exports. SVG keeps
          source curves and transparent cuts; fonts preserve quadratic outlines
          and trace composed cuts and strokes.
        </p>
      </div>
      <button className="primary" onClick={close}>
        Got it
      </button>
    </Modal>
  );
}
