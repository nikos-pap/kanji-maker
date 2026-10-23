import { useEffect, useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import { useCanvasView } from "../../hooks/useCanvasView";
import { EditorCanvas } from "../EditorCanvas";
import { CharacterForm } from "../CharacterForm";
import { FontPicker } from "../FontPicker";
import { LibraryDialog } from "../LibraryDialog";
import { ExportPanel } from "../ExportPanel";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTools } from "./MobileTools";
import { MobileViewControls } from "./MobileViewControls";

export function MobileEditor({ editor: e }: { editor: Editor }) {
  const { camera, setCamera, zoomTo, fit, setBounds } = useCanvasView(
    e.session,
    true,
  );
  const [sheet, setSheet] = useState<
    "character" | "library" | "font" | "export" | null
  >(null);
  const sheetLabels = {
    character: "Character",
    library: "Library",
    font: "Font",
    export: "Export and copy",
  };
  useEffect(() => setSheet(null), [e.session]);
  return (
    <main className="phone-screen" aria-label="Phone character editor">
      <MobileTopBar
        editor={e}
        onCharacters={() => setSheet("character")}
        onLibrary={() => setSheet("library")}
        onFont={() => setSheet("font")}
        onExport={() => setSheet("export")}
      />
      <div className="phone-stage">
        <EditorCanvas
          key={e.session}
          model={e.model}
          tool={e.tool}
          brush={e.brush}
          brushShape={e.brushShape}
          guides={e.guides}
          camera={camera}
          bounded
          onViewportSize={setBounds}
          onCameraChange={setCamera}
          busy={e.busy}
          onChange={e.changeModel}
          onCommit={e.remember}
          onGesture={e.onGesture}
          notify={e.notify}
        />
        <MobileViewControls
          editor={e}
          zoom={camera.zoom}
          onZoom={zoomTo}
          onFit={fit}
        />
        <MobileTools editor={e} />
      </div>
      {sheet === "library" && (
        <LibraryDialog
          editor={e}
          current={e.currentEntry?.id}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet !== "library" && (
        <Modal
          id="phonePanel"
          className="phone-sheet"
          label={sheetLabels[sheet]}
          onDismiss={() => setSheet(null)}
        >
          <div className="phone-sheet-heading">
            <h2>{sheetLabels[sheet]}</h2>
            <button aria-label="Close panel" onClick={() => setSheet(null)}>
              <Icon name="close" />
            </button>
          </div>
          {sheet === "character" && <CharacterForm editor={e} />}
          {sheet === "font" && <FontPicker editor={e} />}
          {sheet === "export" && (
            <>
              <ExportPanel editor={e} />
              <div className="phone-sheet-secondary">
                <button
                  disabled={!e.edited || e.busy}
                  onClick={() => {
                    e.reset();
                    setSheet(null);
                  }}
                >
                  Reset edits
                </button>
                <button
                  onClick={() => {
                    setSheet(null);
                    e.setHelp(true);
                  }}
                >
                  Help
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
