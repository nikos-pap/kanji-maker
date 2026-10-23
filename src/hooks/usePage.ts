import { useSyncExternalStore } from "react";
const subscribe = (changed: () => void) => {
  addEventListener("hashchange", changed);
  return () => removeEventListener("hashchange", changed);
};
export const usePage = () =>
  useSyncExternalStore(
    subscribe,
    () => (location.hash === "#compose" ? "compose" : "editor"),
    () => "editor",
  );
