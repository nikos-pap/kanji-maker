import type { ReactNode } from "react";
import { PanelDialog } from "../PanelDialog";

export function ComposerDialog({
  id,
  title,
  compact,
  onClose,
  children,
}: {
  id: string;
  title: string;
  compact: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <PanelDialog
      id={id}
      title={title}
      compact={compact}
      className="composer-dialog"
      closeLabel="Close component panel"
      onClose={onClose}
    >
      {children}
    </PanelDialog>
  );
}
