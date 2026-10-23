import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Modal({
  children,
  onDismiss,
  id,
  className,
  label,
}: {
  children: ReactNode;
  onDismiss: () => void;
  id: string;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      id={id}
      className={className}
      aria-label={label}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
