import type { Editor } from "../hooks/useEditor";
import { useCanvasView } from "../hooks/useCanvasView";
import { CharacterForm } from "./CharacterForm";
import { FontPicker } from "./FontPicker";
import { EditorToolbar } from "./EditorToolbar";
import { EditorCanvas } from "./EditorCanvas";

export function EditorWorkspace({ editor }: { editor: Editor }) {
  const { camera, setCamera, zoomTo, fit } = useCanvasView(editor.session);
  return (
    <section className="workspace" aria-label="Character editor">
      <div className="source-controls">
        <CharacterForm editor={editor} />
        <FontPicker editor={editor} />
      </div>
      <EditorToolbar
        editor={editor}
        zoom={camera.zoom}
        onZoom={zoomTo}
        onFit={fit}
      />
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
    </section>
  );
}
