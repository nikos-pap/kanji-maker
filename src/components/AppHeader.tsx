export function AppHeader({ onHelp }: { onHelp: () => void }) {
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
      <button id="help" className="quiet" onClick={onHelp}>
        Help
      </button>
    </header>
  );
}
