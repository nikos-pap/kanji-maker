import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrushShape,
  GlyphModel,
  LibraryEntry,
  LibraryMeta,
  SourceFont,
  Tool,
} from "../types";
import { clone, glyphPath } from "../lib/geometry";
import type { Composition } from "../lib/composition";
import { compositionPng, compositionSvg } from "../lib/compositionExport";
import {
  allocateCode,
  appFile,
  DRAFT,
  familyName,
  fingerprint,
  importLibrary,
  META,
  newMeta,
  normalizeEntries,
  STORAGE,
  validMeta,
  validModel,
  upsertComposition,
  compositionForModel,
} from "../lib/storage";
import {
  download,
  libraryFont,
  loadIncludedFont,
  parseFont,
  png,
  svgText,
} from "../lib/font";
import { clipboardHtml, makeDocx } from "../lib/exports";

type EditorSnapshot = {
  model: GlyphModel;
  libraryId: string | null;
  saved: string;
};
const BLANK_PATH = "M0 0Z";
const emptyModel = (): GlyphModel => ({
  version: 1,
  character: "長",
  name: "長 variant",
  basePath: "",
  operations: [],
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
function restore() {
  let model = emptyModel(),
    library: LibraryEntry[] = [],
    meta = newMeta(),
    libraryId: string | null = null,
    saved = "",
    warning = "";
  try {
    meta = validMeta(JSON.parse(localStorage.getItem(META) || "null")) || meta;
    library = normalizeEntries(
      JSON.parse(localStorage.getItem(STORAGE) || "[]"),
      meta,
      true,
    );
    const draft: unknown = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (draft && typeof draft === "object" && "model" in draft) {
      model = validModel(draft.model);
      if ("libraryId" in draft && typeof draft.libraryId === "string")
        libraryId = draft.libraryId;
      if ("saved" in draft && typeof draft.saved === "string" && draft.saved)
        saved = fingerprint(validModel(JSON.parse(draft.saved)));
    }
  } catch {
    warning =
      "Some browser data could not be read. Import an app-file backup if needed.";
  }
  return { model, library, meta, libraryId, saved, warning };
}

export function useEditor(active = true) {
  const [initial] = useState(restore);
  const [model, setModel] = useState(initial.model),
    [library, setLibrary] = useState(initial.library),
    [meta, setMeta] = useState(initial.meta);
  const [libraryId, setLibraryId] = useState(initial.libraryId),
    [saved, setSaved] = useState(initial.saved);
  const [past, setPast] = useState<EditorSnapshot[]>([]),
    [future, setFuture] = useState<EditorSnapshot[]>([]);
  const [tool, setTool] = useState<Tool>("draw"),
    [brush, setBrush] = useState(45),
    [brushShape, setBrushShape] = useState<BrushShape>("round"),
    [guides, setGuides] = useState(true);
  const [busy, setBusy] = useState(false),
    [character, setCharacter] = useState(initial.model.character),
    [fontLabel, setFontLabel] = useState("Included Japanese serif");
  const [fontReady, setFontReady] = useState(false);
  const [copyMode, setCopyMode] = useState<"text" | "image">("text"),
    [session, setSession] = useState(0),
    [help, setHelp] = useState(false);
  const [message, setMessage] = useState({
    text: "Loading the included font…",
    error: false,
  });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  const font = useRef<SourceFont | null>(null),
    defaultFont = useRef<SourceFont | null>(null),
    licence = useRef(""),
    customFont = useRef(false);
  const gesture = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    storageError = useRef(false),
    running = useRef(false);
  const notify = useCallback((text: string, error = false, sticky = false) => {
    clearTimeout(timer.current);
    setMessage({ text, error });
    if (!sticky)
      timer.current = setTimeout(
        () => setMessage({ text: "", error: false }),
        error ? 8000 : 3500,
      );
  }, []);
  const onGesture = useCallback((active: boolean) => {
    gesture.current = active;
  }, []);
  const remember = useCallback(
    (previous: GlyphModel) => {
      setPast((p) => [
        ...p.slice(-69),
        { model: clone(previous), libraryId, saved },
      ]);
      setFuture([]);
    },
    [libraryId, saved],
  );
  const changeModel = useCallback((next: GlyphModel) => setModel(next), []);
  const currentEntry = model.basePath
    ? library.find(
        (g) =>
          g.id === libraryId && fingerprint(g.model) === fingerprint(model),
      )
    : undefined;
  const isBlank =
    !model.basePath ||
    (model.basePath === BLANK_PATH && !model.operations.length);
  const edited =
    !!model.operations.length ||
    (!!model.originalPath && model.basePath !== model.originalPath);
  const family = familyName(meta),
    disabled = busy || isBlank;
  function persistLibrary(
    next: LibraryEntry[],
    nextMeta: LibraryMeta,
  ): boolean {
    try {
      localStorage.setItem(META, JSON.stringify(nextMeta));
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setLibrary(next);
      setMeta(nextMeta);
      return true;
    } catch {
      notify(
        "Browser storage is unavailable or full. Download a library backup to keep your work.",
        true,
        true,
      );
      return false;
    }
  }
  useEffect(() => {
    if (!model.basePath) return;
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ model, libraryId, saved }));
    } catch {
      if (!storageError.current) {
        storageError.current = true;
        notify(
          "Browser storage is unavailable or full. Download a backup to keep your work.",
          true,
          true,
        );
      }
    }
  }, [model, libraryId, saved, notify]);
  useEffect(() => {
    const controller = new AbortController();
    loadIncludedFont(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        defaultFont.current = loaded.font;
        licence.current = loaded.licence;
        if (!font.current) font.current = loaded.font;
        setFontReady(true);
        setModel((current) => {
          if (current.basePath) return current;
          const basePath = glyphPath(loaded.font, "長");
          return {
            ...current,
            basePath,
            originalPath: basePath,
            fontLabel: "Included Japanese serif",
            customFont: false,
          };
        });
        notify(initial.warning, !!initial.warning);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          notify(
            `Could not load the included font: ${errorText(error)}. Open Library to choose a TTF or OTF.`,
            true,
            true,
          );
      });
    return () => {
      controller.abort();
      clearTimeout(timer.current);
    };
  }, [initial, notify]);
  function confirm(title: string, text: string): Promise<boolean> {
    return new Promise((resolve) => setConfirmation({ title, text, resolve }));
  }
  function answerConfirmation(answer: boolean) {
    confirmation?.resolve(answer);
    setConfirmation(null);
  }
  async function canReplace() {
    return (
      !edited ||
      (!!model.basePath && fingerprint(model) === saved) ||
      (await confirm(
        "Replace the current character?",
        "Save it to your library first if you want to keep this version.",
      ))
    );
  }
  function replace(next: GlyphModel, entry?: LibraryEntry) {
    setModel(next);
    setCharacter(next.character);
    setLibraryId(entry?.id || null);
    setSaved(entry ? fingerprint(next) : "");
    setPast([]);
    setFuture([]);
    setSession((s) => s + 1);
  }
  const getCharacterOutline = useCallback(
    (character: string) => {
      if (!font.current)
        throw Error(
          "The font is still loading. You can add a built-in stroke while you wait.",
        );
      const path = glyphPath(font.current, character);
      if (!path) throw Error("That character has no visible outline.");
      return { path, fontLabel, customFont: customFont.current };
    },
    [fontLabel, fontReady],
  );
  async function openComposition(next: GlyphModel) {
    if (busy || !(await canReplace())) return false;
    replace(clone(next));
    notify("Composition opened. Save it to your library or continue editing.");
    return true;
  }
  async function loadCharacter() {
    if (busy || gesture.current) return;
    const chars = [...character.trim()];
    if (chars.length !== 1) {
      notify("Enter one character to start with.", true);
      return;
    }
    if (!font.current) {
      notify(
        "The font is not ready yet. You can also choose a font file.",
        true,
      );
      return;
    }
    try {
      const basePath = glyphPath(font.current, chars[0]);
      if (!basePath) throw Error("That character has no visible outline.");
      if (!(await canReplace())) return;
      replace({
        version: 1,
        character: chars[0],
        name: `${chars[0]} variant`,
        basePath,
        originalPath: basePath,
        operations: [],
        fontLabel,
        customFont: customFont.current,
      });
      notify("");
    } catch (error) {
      notify(errorText(error), true);
    }
  }
  async function chooseFont(file: File) {
    if (!(await canReplace())) return;
    try {
      notify("Reading font…", false, true);
      const loaded = parseFont(new Uint8Array(await file.arrayBuffer())),
        char = [...character.trim()][0] || "長",
        basePath = glyphPath(loaded, char);
      if (!basePath) throw Error("That character has no visible outline.");
      font.current = loaded;
      setFontReady(true);
      customFont.current = true;
      setFontLabel(file.name);
      replace({
        version: 1,
        character: char,
        name: `${char} variant`,
        basePath,
        originalPath: basePath,
        operations: [],
        fontLabel: file.name,
        customFont: true,
      });
      notify(`Loaded ${file.name}.`);
    } catch (error) {
      notify(`Could not use this font: ${errorText(error)}`, true);
    }
  }
  function restoreSnapshot(next: EditorSnapshot) {
    setModel(clone(next.model));
    setCharacter(next.model.character);
    setLibraryId(next.libraryId);
    setSaved(next.saved);
    setSession((s) => s + 1);
  }
  function undo() {
    if (!past.length || gesture.current || busy) return;
    setFuture((f) => [...f, { model: clone(model), libraryId, saved }]);
    restoreSnapshot(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length || gesture.current || busy) return;
    setPast((p) => [...p, { model: clone(model), libraryId, saved }]);
    restoreSnapshot(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
  }
  function clear() {
    if (isBlank || gesture.current || busy) return;
    remember(model);
    setModel({
      version: 1,
      character: "",
      name: "Custom character",
      basePath: BLANK_PATH,
      originalPath: BLANK_PATH,
      operations: [],
    });
    setCharacter("");
    setLibraryId(null);
    setSaved("");
    setSession((s) => s + 1);
  }
  function selectTool(next: Tool) {
    if (!gesture.current && !busy) setTool(next);
  }
  useEffect(() => {
    if (!active) return;
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as Element).closest("input,textarea,select,dialog") ||
        busy ||
        gesture.current
      )
        return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        redo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const shortcuts: Record<string, Tool> = {
          n: "points",
          e: "erase",
          r: "cut",
          d: "draw",
          l: "line",
        };
        if (shortcuts[key]) {
          e.preventDefault();
          selectTool(shortcuts[key]);
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  });
  function saveGlyph() {
    if (disabled) return;
    try {
      const nextModel = {
          ...model,
          name: model.name.trim() || `${model.character || "Custom"} variant`,
        },
        nextMeta = clone(meta);
      const old = library.find((g) => g.id === libraryId),
        id = old?.id || crypto.randomUUID(),
        codePoint = old?.codePoint ?? allocateCode(nextMeta);
      const composition = compositionForModel(old, nextModel);
      const item = {
          id,
          codePoint,
          model: clone(nextModel),
          ...(composition ? { composition } : {}),
        },
        next = [item, ...library.filter((g) => g.id !== id)];
      nextMeta.revision++;
      if (!persistLibrary(next, nextMeta)) return;
      setModel(nextModel);
      setLibraryId(id);
      setSaved(fingerprint(nextModel));
      notify("Saved to your library.");
    } catch (error) {
      notify(errorText(error), true);
    }
  }
  async function openGlyph(entry: LibraryEntry) {
    if (!busy && (await canReplace())) {
      replace(clone(entry.model), entry);
      notify("Saved character opened.");
      return true;
    }
    return false;
  }
  function saveComposition(composition: Composition, glyph: GlyphModel) {
    if (busy) return null;
    try {
      const next = upsertComposition(library, meta, composition, glyph);
      if (!persistLibrary(next.library, next.meta)) return null;
      notify("Composition saved to your library.");
      return next.entry.id;
    } catch (error) {
      notify(errorText(error), true);
      return null;
    }
  }
  async function removeGlyph(entry: LibraryEntry) {
    if (
      busy ||
      !(await confirm(
        "Remove saved character?",
        `Remove “${entry.model.name}” from this browser’s library? The character currently on the canvas will stay.`,
      ))
    )
      return;
    if (
      persistLibrary(
        library.filter((g) => g.id !== entry.id),
        { ...meta, revision: meta.revision + 1 },
      ) &&
      libraryId === entry.id
    ) {
      setLibraryId(null);
      setSaved("");
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 20000000) throw Error("This backup is too large.");
      const result = importLibrary(
        JSON.parse(await file.text()),
        library,
        meta,
      );
      if (persistLibrary(result.library, result.meta))
        notify(
          `Imported ${result.count} character${result.count === 1 ? "" : "s"}.`,
        );
    } catch (error) {
      notify(`Could not import: ${errorText(error)}`, true);
    }
  }
  async function runExport(action: () => Promise<void>) {
    if (running.current || gesture.current) return false;
    running.current = true;
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      notify(`Could not export: ${errorText(error)}`, true);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function exportSavedImage(entry: LibraryEntry, kind: "svg" | "png") {
    return runExport(async () => {
      const filename = (entry.model.name.trim() || "custom-kanji")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
        .slice(0, 80);
      const blob =
        kind === "svg"
          ? new Blob(
              [
                entry.composition
                  ? compositionSvg(entry.composition)
                  : svgText(entry.model),
              ],
              { type: "image/svg+xml" },
            )
          : await (entry.composition
              ? compositionPng(entry.composition)
              : png(entry.model));
      download(blob, filename + "." + kind);
      notify("Download ready.");
    });
  }
  function exportLibrary(kind: "word" | "font" | "json") {
    if (!library.length || busy) return;
    void runExport(async () => {
      if (kind === "json")
        download(appFile(library, meta), "kanji-library.json");
      else {
        const fonts = [defaultFont.current, font.current].filter(
          (f): f is SourceFont => !!f,
        );
        const bytes = await libraryFont(
          clone(library),
          family,
          meta.revision,
          licence.current,
          fonts,
          (text) => notify(text, false, true),
        );
        if (kind === "word")
          download(
            makeDocx(
              bytes,
              family,
              library.map((g) => ({
                codePoint: g.codePoint,
                name: g.model.name,
              })),
            ),
            "kanji-library.docx",
          );
        else download(new Blob([bytes], { type: "font/ttf" }), `${family}.ttf`);
      }
      notify("Library downloaded.");
    });
  }
  async function copyForDocument(entry = currentEntry) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw Error("Use a Word export or a downloaded PNG in this browser.");
      if (copyMode === "image")
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": png(entry?.model || model, 1024) }),
        ]);
      else {
        if (!entry)
          throw Error("Save the current version to the library first.");
        const character = String.fromCodePoint(entry.codePoint);
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([character], { type: "text/plain" }),
            "text/html": new Blob([clipboardHtml(character, family)], {
              type: "text/html",
            }),
          }),
        ]);
      }
      notify(
        copyMode === "image"
          ? "Transparent image copied."
          : "Formatted text copied. Paste with source formatting using the installed library font.",
      );
    } catch (error) {
      notify(`Could not copy: ${errorText(error)}`, true);
    }
  }
  return {
    fontReady,
    getCharacterOutline,
    openComposition,
    saveComposition,
    model,
    changeModel,
    remember,
    library,
    family,
    busy,
    disabled,
    past,
    future,
    tool,
    selectTool,
    brush,
    setBrush,
    character,
    setCharacter,
    fontLabel,
    loadCharacter,
    chooseFont,
    undo,
    redo,
    clear,
    isBlank,
    saveGlyph,
    openGlyph,
    removeGlyph,
    importFile,
    exportSavedImage,
    exportLibrary,
    copyMode,
    setCopyMode,
    copyForDocument,
    currentEntry,
    brushShape,
    setBrushShape,
    guides,
    setGuides,
    session,
    onGesture,
    notify,
    message,
    help,
    setHelp,
    confirmation,
    answerConfirmation,
  };
}
export type Editor = ReturnType<typeof useEditor>;
