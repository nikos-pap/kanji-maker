export function AppHeader({
  onHelp,
  onLibrary,
  onImport,
}: {
  onHelp: () => void;
  onLibrary: () => void;
  onImport: () => void;
}) {
  return (
    <header>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          字
        </span>
        <div>
          <h1>Kanji Maker</h1>
        </div>
      </div>
      <nav className="app-navigation" aria-label="Editor pages">
        <a href="#compose">Radicals &amp; strokes</a>
        <button onClick={onLibrary}>Library</button>
        <button onClick={onImport}>Import</button>
        <button id="help" className="quiet" onClick={onHelp}>
          Help
        </button>
      </nav>
    </header>
  );
}
