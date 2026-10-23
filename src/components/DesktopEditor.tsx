import type { Editor } from "../hooks/useEditor";
import { AppHeader } from "./AppHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { ExportPanel } from "./ExportPanel";
import { GlyphPreview } from "./GlyphPreview";
import { LibraryPanel } from "./LibraryPanel";

export function DesktopEditor({ editor }: { editor: Editor }) {
  return (
    <>
      <AppHeader onHelp={() => editor.setHelp(true)} />
      <main>
        <EditorWorkspace editor={editor} />
        <aside>
          <GlyphPreview model={editor.model} />
          <ExportPanel editor={editor} />
          <LibraryPanel editor={editor} />
        </aside>
      </main>
    </>
  );
}
