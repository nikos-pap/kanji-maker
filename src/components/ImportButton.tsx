import { useRef } from "react";
import { Icon } from "./Icon";

export function ImportButton({
  id,
  disabled,
  onImport,
}: {
  id: string;
  disabled: boolean;
  onImport: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        aria-label="Import app file"
        title="Import"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Icon name="import" />
      </button>
      <input
        ref={input}
        id={id}
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void onImport(file);
        }}
      />
    </>
  );
}
