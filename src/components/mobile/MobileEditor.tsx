import { useState } from "react";
import type { Editor } from "../../hooks/useEditor";
import { useCanvasView } from "../../hooks/useCanvasView";
import { EditorCanvas } from "../EditorCanvas";
import { LibraryDialog } from "../LibraryDialog";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTools } from "./MobileTools";
import { MobileViewControls } from "./MobileViewControls";

export function MobileEditor({ editor: e }: { editor: Editor }) {
  const { camera, setCamera, zoomTo, fit, setBounds } = useCanvasView(
    e.session,
    true,
  );
  const [library, setLibrary] = useState(false);
  return (
    <main className="phone-screen" aria-label="Phone character editor">
      <MobileTopBar editor={e} onLibrary={() => setLibrary(true)} />
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
      {library && (
        <LibraryDialog
          editor={e}
          current={e.currentEntry?.id}
          onClose={() => setLibrary(false)}
        />
      )}
    </main>
  );
}
