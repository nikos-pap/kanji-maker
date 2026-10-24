import type { Editor } from "../hooks/useEditor";
import { useCanvasView } from "../hooks/useCanvasView";
import { EditorToolbar } from "./EditorToolbar";
import { EditorCanvas } from "./EditorCanvas";
import { ZoomControls } from "./ZoomControls";

export function EditorWorkspace({
  editor,
  onPreview,
}: {
  editor: Editor;
  onPreview: () => void;
}) {
  const { camera, setCamera, zoomTo, fit } = useCanvasView(editor.session);
  return (
    <section className="workspace" aria-label="Character editor">
      <EditorToolbar editor={editor} onPreview={onPreview} />
      <div className="desktop-canvas-stage">
        <EditorCanvas
          key={editor.session}
          model={editor.model}
          tool={editor.tool}
          brush={editor.brush}
          brushShape={editor.brushShape}
          guides={editor.guides}
          camera={camera}
          onCameraChange={setCamera}
          busy={editor.busy}
          onChange={editor.changeModel}
          onCommit={editor.remember}
          onGesture={editor.onGesture}
          notify={editor.notify}
        />
        <div className="desktop-view-controls">
          <ZoomControls
            zoom={camera.zoom}
            onZoom={zoomTo}
            onFit={fit}
            disabled={editor.busy}
          />
        </div>
      </div>
    </section>
  );
}
