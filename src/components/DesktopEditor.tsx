import { useRef, useState } from "react";
import type { Editor } from "../hooks/useEditor";
import { AppHeader } from "./AppHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { CharacterPanel } from "./CharacterPanel";
import { GlyphPreview } from "./GlyphPreview";
import { LibraryDialog } from "./LibraryDialog";

export function DesktopEditor({ editor }: { editor: Editor }) {
  const [library, setLibrary] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <AppHeader
        editor={editor}
        onHelp={() => editor.setHelp(true)}
        onLibrary={() => setLibrary(true)}
        onImport={() => importInput.current?.click()}
      />
      <main>
        <EditorWorkspace editor={editor} />
        <aside>
          <GlyphPreview model={editor.model} />
          <CharacterPanel editor={editor} />
        </aside>
      </main>
      <input
        ref={importInput}
        id="projectFile"
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void editor.importFile(file);
        }}
      />
      {library && (
        <LibraryDialog
          editor={editor}
          current={editor.currentEntry?.id}
          onClose={() => setLibrary(false)}
        />
      )}
    </>
  );
}
