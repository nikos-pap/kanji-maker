import { useEffect, useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import { useCanvasView } from "../../hooks/useCanvasView";
import { EditorCanvas } from "../EditorCanvas";
import { CharacterForm } from "../CharacterForm";
import { LibraryPanel } from "../LibraryPanel";
import { ExportPanel } from "../ExportPanel";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTools } from "./MobileTools";
import { MobileSliders } from "./MobileSliders";

export function MobileEditor({ editor: e }: { editor: Editor }) {
  const { camera, setCamera, zoomTo, fit } = useCanvasView(e.session);
  const [sheet, setSheet] = useState<"characters" | "export" | null>(null);
  useEffect(() => setSheet(null), [e.session]);
  return (
    <main className="phone-screen" aria-label="Phone character editor">
      <MobileTopBar
        editor={e}
        onCharacters={() => setSheet("characters")}
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
          onCameraChange={setCamera}
          busy={e.busy}
          onChange={e.changeModel}
          onCommit={e.remember}
          onGesture={e.onGesture}
          notify={e.notify}
        />
        <MobileSliders
          editor={e}
          zoom={camera.zoom}
          onZoom={zoomTo}
          onFit={fit}
        />
        <MobileTools editor={e} />
      </div>
      {sheet && (
        <Modal
          id="phonePanel"
          className="phone-sheet"
          label={
            sheet === "characters" ? "Character and library" : "Export and copy"
          }
          onDismiss={() => setSheet(null)}
        >
          <div className="phone-sheet-heading">
            <h2>{sheet === "characters" ? "Character & library" : "Export"}</h2>
            <button aria-label="Close panel" onClick={() => setSheet(null)}>
              <Icon name="close" />
            </button>
          </div>
          {sheet === "characters" ? (
            <>
              <CharacterForm editor={e} />
              <LibraryPanel editor={e} />
            </>
          ) : (
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
