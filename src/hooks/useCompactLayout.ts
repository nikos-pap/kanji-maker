import { useSyncExternalStore } from "react";

const query = "(max-width: 760px), (max-width: 1024px) and (max-height: 500px)";
const subscribe = (changed: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};
export const useCompactLayout = () =>
  useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
