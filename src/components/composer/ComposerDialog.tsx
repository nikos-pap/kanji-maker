import type { ReactNode } from "react";
import { PanelDialog } from "../PanelDialog";

export function ComposerDialog({
  id,
  title,
  compact,
  className = "",
  onClose,
  children,
}: {
  id: string;
  title: string;
  compact: boolean;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <PanelDialog
      id={id}
      title={title}
      compact={compact}
      className={"composer-dialog " + className}
      closeLabel="Close component panel"
      onClose={onClose}
    >
      {children}
    </PanelDialog>
  );
}
