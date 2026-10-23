import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GlyphModel,
  LibraryEntry,
  LibraryMeta,
  SourceFont,
  Tool,
} from "../types";
import { clone, glyphPath } from "../lib/geometry";
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
} from "../lib/storage";
import {
  download,
  libraryFont,
  loadIncludedFont,
  outlineForModel,
  parseFont,
  png,
  svgText,
} from "../lib/font";
import { clipboardHtml, makeDocx, makeFont } from "../lib/exports";

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

export function useEditor() {
  const [initial] = useState(restore);
  const [model, setModel] = useState(initial.model),
    [library, setLibrary] = useState(initial.library),
    [meta, setMeta] = useState(initial.meta);
  const [libraryId, setLibraryId] = useState(initial.libraryId),
    [saved, setSaved] = useState(initial.saved);
  const [past, setPast] = useState<GlyphModel[]>([]),
    [future, setFuture] = useState<GlyphModel[]>([]);
  const [tool, setTool] = useState<Tool>("erase"),
    [brush, setBrush] = useState(45),
    [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false),
    [character, setCharacter] = useState(initial.model.character),
    [fontLabel, setFontLabel] = useState("Included Japanese serif");
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
  const remember = useCallback((previous: GlyphModel) => {
    setPast((p) => [...p.slice(-69), clone(previous)]);
    setFuture([]);
  }, []);
  const changeModel = useCallback((next: GlyphModel) => setModel(next), []);
  const currentEntry = model.basePath
    ? library.find(
        (g) =>
          g.id === libraryId && fingerprint(g.model) === fingerprint(model),
      )
    : undefined;
  const edited =
    !!model.operations.length ||
    (!!model.originalPath && model.basePath !== model.originalPath);
  const family = familyName(meta),
    disabled = busy || !model.basePath || pending;
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
        notify(
          initial.warning ||
            (initial.model.basePath
              ? "Your previous character is ready."
              : "Ready. Erase or draw to change the character."),
          !!initial.warning,
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          notify(
            `Could not load the included font: ${errorText(error)}. Use Choose font to load a TTF or OTF.`,
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
      (!edited && !pending) ||
      (!!model.basePath && fingerprint(model) === saved && !pending) ||
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
    setPending(false);
    setSession((s) => s + 1);
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
      notify("Character loaded. Erase or draw to change its shape.");
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
  function undo() {
    if (!past.length || gesture.current || busy) return;
    setFuture((f) => [...f, clone(model)]);
    setModel(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setPending(false);
    setSession((s) => s + 1);
  }
  function redo() {
    if (!future.length || gesture.current || busy) return;
    setPast((p) => [...p, clone(model)]);
    setModel(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
    setPending(false);
    setSession((s) => s + 1);
  }
  function reset() {
    if (!edited || gesture.current || busy) return;
    remember(model);
    setModel({
      ...model,
      basePath: model.originalPath || model.basePath,
      operations: [],
    });
    setPending(false);
    setSession((s) => s + 1);
  }
  function selectTool(next: Tool) {
    if (!gesture.current && !busy) setTool(next);
  }
  useEffect(() => {
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
          p: "polygon",
          d: "draw",
          l: "line",
          h: "pan",
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
      const item = { id, codePoint, model: clone(nextModel) },
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
    if (running.current || gesture.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notify(`Could not export: ${errorText(error)}`, true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const filename = () =>
    (model.name.trim() || "custom-kanji")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .slice(0, 80);
  function exportCurrent(kind: "svg" | "png" | "font" | "json") {
    if (disabled) return;
    void runExport(async () => {
      if (kind === "svg")
        download(
          new Blob([svgText(model)], { type: "image/svg+xml" }),
          `${filename()}.svg`,
        );
      else if (kind === "png") download(await png(model), `${filename()}.png`);
      else if (kind === "json")
        download(
          appFile(
            [
              {
                id: crypto.randomUUID(),
                codePoint: 0xe000,
                model: clone(model),
              },
            ],
            { ...newMeta(), nextCodePoint: 0xe001 },
          ),
          `${filename()}.kanji.json`,
        );
      else {
        notify("Building the font…", false, true);
        const family = `KanjiMaker-${Date.now().toString(36)}`;
        const text = model.customFont
          ? `Created from ${model.fontLabel || "an uploaded font"}. Its source licence applies.`
          : licence.current;
        const bytes = makeFont(
          [{ codePoint: 0xe000, contours: await outlineForModel(model) }],
          family,
          text,
        );
        if (!parseFont(bytes).hasGlyphForCodePoint(0xe000))
          throw Error("Font validation failed.");
        download(new Blob([bytes], { type: "font/ttf" }), `${family}.ttf`);
      }
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
  async function copyCharacter() {
    try {
      await navigator.clipboard.writeText("\uE000");
      notify(
        "Private character copied. Use it with your exported single-character font.",
      );
    } catch {
      notify(
        "Copy this character and use your exported single-character font: \uE000",
        true,
        true,
      );
    }
  }
  return {
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
    reset,
    edited,
    saveGlyph,
    openGlyph,
    removeGlyph,
    importFile,
    exportCurrent,
    exportLibrary,
    copyMode,
    setCopyMode,
    copyForDocument,
    copyCharacter,
    currentEntry,
    pending,
    setPending,
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
