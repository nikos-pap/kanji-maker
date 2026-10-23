import { DesktopEditor } from "./components/DesktopEditor";
import { MobileEditor } from "./components/mobile/MobileEditor";
import { useCompactLayout } from "./hooks/useCompactLayout";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { HelpDialog } from "./components/HelpDialog";
import { useEditor } from "./hooks/useEditor";
import { usePage } from "./hooks/usePage";
import { ComposerPage } from "./components/composer/ComposerPage";

export default function App() {
  const page = usePage();
  const editor = useEditor(page === "editor");
  const compact = useCompactLayout();
  return (
    <>
      {page === "compose" ? (
        <ComposerPage editor={editor} />
      ) : compact ? (
        <MobileEditor editor={editor} />
      ) : (
        <DesktopEditor editor={editor} />
      )}
      <div
        id="status"
        role="status"
        aria-live="polite"
        className={editor.message.error ? "error" : ""}
      >
        {editor.message.text}
      </div>
      {editor.help && <HelpDialog close={() => editor.setHelp(false)} />}
      {editor.confirmation && (
        <ConfirmationDialog
          title={editor.confirmation.title}
          text={editor.confirmation.text}
          onAnswer={editor.answerConfirmation}
        />
      )}
    </>
  );
}
