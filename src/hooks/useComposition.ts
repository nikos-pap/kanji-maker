import { useEffect, useRef, useState } from "react";
import {
  COMPOSITION_DRAFT,
  emptyComposition,
  parseComposition,
} from "../lib/composition";
import type { ComponentPart, Composition } from "../lib/composition";

function restore() {
  try {
    const saved = localStorage.getItem(COMPOSITION_DRAFT);
    return {
      document: saved
        ? parseComposition(JSON.parse(saved))
        : emptyComposition(),
      warning: "",
    };
  } catch {
    return {
      document: emptyComposition(),
      warning:
        "The saved composition could not be read. Import a composition backup to restore it.",
    };
  }
}
export function useComposition(
  notify: (text: string, error?: boolean) => void,
) {
  const [initial] = useState(restore);
  const [document, setDocument] = useState(initial.document);
  const live = useRef(document);
  const [selected, select] = useState<string | null>(
    document.parts.at(-1)?.id || null,
  );
  const [past, setPast] = useState<Composition[]>([]),
    [future, setFuture] = useState<Composition[]>([]);
  const gesture = useRef<Composition | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const storageWarning = useRef(false);
  const publish = (next: Composition) => {
    live.current = next;
    setDocument(next);
  };
  const remember = (previous: Composition) => {
    setPast((p) => [...p.slice(-49), previous]);
    setFuture([]);
  };
  function commit(next: Composition) {
    if (JSON.stringify(next) === JSON.stringify(live.current)) return;
    remember(live.current);
    publish(next);
  }
  useEffect(() => {
    if (initial.warning) notify(initial.warning, true);
  }, [initial, notify]);
  useEffect(() => {
    if (gesturing || (initial.warning && document === initial.document)) return;
    try {
      localStorage.setItem(COMPOSITION_DRAFT, JSON.stringify(document));
    } catch {
      if (!storageWarning.current) {
        storageWarning.current = true;
        notify(
          "Could not save this composition in the browser. Export an SVG or PNG to keep a copy.",
          true,
        );
      }
    }
  }, [document, gesturing, initial, notify]);
  useEffect(() => {
    if (selected && !document.parts.some((p) => p.id === selected))
      select(document.parts.at(-1)?.id || null);
  }, [document, selected]);
  function updatePart(part: ComponentPart, preview = false) {
    const next = {
      ...live.current,
      parts: live.current.parts.map((p) => (p.id === part.id ? part : p)),
    };
    if (preview) publish(next);
    else commit(next);
  }
  function begin() {
    gesture.current = live.current;
    setGesturing(true);
  }
  function end(cancel = false) {
    const previous = gesture.current;
    gesture.current = null;
    setGesturing(false);
    if (!previous) return;
    if (cancel) publish(previous);
    else if (JSON.stringify(previous) !== JSON.stringify(live.current))
      remember(previous);
  }
  function undo() {
    if (!past.length || gesture.current) return;
    setFuture((f) => [...f, live.current]);
    publish(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length || gesture.current) return;
    setPast((p) => [...p, live.current]);
    publish(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
  }
  function add(part: ComponentPart) {
    if (live.current.parts.length >= 100) {
      notify("A composition can contain up to 100 components.", true);
      return;
    }
    commit({ ...live.current, parts: [...live.current.parts, part] });
    select(part.id);
  }
  function remove() {
    commit({
      ...live.current,
      parts: live.current.parts.filter((p) => p.id !== selected),
    });
  }
  function duplicate() {
    const part = live.current.parts.find((p) => p.id === selected);
    if (part)
      add({
        ...structuredClone(part),
        id: crypto.randomUUID(),
        x: part.x + 25,
        y: part.y + 25,
      });
  }
  function reorder(direction: -1 | 1) {
    const parts = [...live.current.parts],
      index = parts.findIndex((p) => p.id === selected),
      target = index + direction;
    if (index < 0 || target < 0 || target >= parts.length) return;
    [parts[index], parts[target]] = [parts[target], parts[index]];
    commit({ ...live.current, parts });
  }
  return {
    document,
    selected,
    select,
    part: document.parts.find((p) => p.id === selected),
    past,
    future,
    gesturing,
    updatePart,
    begin,
    end,
    undo,
    redo,
    add,
    remove,
    duplicate,
    reorder,
    rename: (name: string) => commit({ ...live.current, name }),
    openDocument: (next: Composition) => {
      publish(next);
      setPast([]);
      setFuture([]);
      select(next.parts.at(-1)?.id || null);
    },
    markSaved: (id: string) => {
      publish({ ...live.current, libraryId: id });
      setPast((p) => p.map((document) => ({ ...document, libraryId: id })));
      setFuture((p) => p.map((document) => ({ ...document, libraryId: id })));
    },
  };
}
export type Composer = ReturnType<typeof useComposition>;
