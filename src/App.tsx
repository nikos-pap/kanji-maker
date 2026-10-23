import { DesktopEditor } from "./components/DesktopEditor";
import { MobileEditor } from "./components/mobile/MobileEditor";
import { useCompactLayout } from "./hooks/useCompactLayout";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { HelpDialog } from "./components/HelpDialog";
import { useEditor } from "./hooks/useEditor";

export default function App() {
  const editor = useEditor();
  const compact = useCompactLayout();
  return (
    <>
      {compact ? (
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
