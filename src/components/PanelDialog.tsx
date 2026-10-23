import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function PanelDialog({
  id,
  title,
  compact = false,
  className = "",
  closeLabel = "Close panel",
  onClose,
  children,
}: {
  id: string;
  title: string;
  compact?: boolean;
  className?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      id={id}
      className={"panel-dialog " + className + (compact ? " phone-sheet" : "")}
      label={title}
      onDismiss={onClose}
    >
      <div className="panel-dialog-heading">
        <h2>{title}</h2>
        <button aria-label={closeLabel} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="panel-dialog-body">{children}</div>
    </Modal>
  );
}
