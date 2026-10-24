import { useState } from "react";
import type { Editor } from "../hooks/useEditor";
import { AppHeader } from "./AppHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { CharacterPanel } from "./CharacterPanel";
import { GlyphPreview } from "./GlyphPreview";
import { LibraryDialog } from "./LibraryDialog";
import { PanelDialog } from "./PanelDialog";

export function DesktopEditor({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<"library" | "preview" | null>(null);
  return (
    <div className="desktop-screen">
      <AppHeader
        editor={editor}
        onHelp={() => editor.setHelp(true)}
        onLibrary={() => setPanel("library")}
      />
      <main className="desktop-main">
        <EditorWorkspace
          editor={editor}
          onPreview={() => setPanel("preview")}
        />
      </main>
      {panel === "library" && (
        <LibraryDialog
          editor={editor}
          current={editor.currentEntry?.id}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "preview" && (
        <PanelDialog
          id="previewDialog"
          title="Preview"
          closeLabel="Close preview"
          onClose={() => setPanel(null)}
        >
          <GlyphPreview model={editor.model} />
          <details className="desktop-character-details">
            <summary>Character details and copy</summary>
            <CharacterPanel editor={editor} />
          </details>
        </PanelDialog>
      )}
    </div>
  );
}
