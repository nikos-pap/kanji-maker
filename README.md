# Kanji Maker

A React and TypeScript Japanese glyph editor, built with Vite. Start from a font
character, edit its outline, and save variants in a browser library. Export Word
documents, reusable fonts, app backups, SVGs and PNGs.

## Develop

Use Node.js 22.12 or newer.

```sh
npm install
npm start
```

Open http://127.0.0.1:4173. Changes to React components, TypeScript and CSS update
in the browser during development.

| Source                                 | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `src/App.tsx`                          | Page composition and shared editor wiring                      |
| `src/components/`                      | Character form, toolbar, panels, preview, header and dialogs   |
| `src/components/EditorCanvas.tsx`      | React SVG canvas, pointer gestures, outline points and zoom    |
| `src/components/Glyph.tsx`             | Shared React glyph rendering for canvas, previews and exports  |
| `src/hooks/useEditor.ts`               | Editor state, undo/redo, persistence, fonts and export actions |
| `src/lib/geometry.ts`                  | Outline parsing, coordinates and point movement                |
| `src/lib/storage.ts`                   | Backup validation, character codes and library compatibility   |
| `src/lib/exports.ts`                   | Typed TrueType and embedded-font Word generation               |
| `src/lib/font.tsx`, `src/lib/trace.ts` | Font loading, rasterization and contour tracing                |
| `src/types.ts`                         | Shared TypeScript models                                       |
| `src/style.css`                        | Appearance and responsive layout                               |
| `index.html`                           | Vite entry that mounts the React application                   |
| `scripts/build.mjs`, `vite.config.ts`  | Production build and GitHub Pages output                       |

## Repository layout and Git

```text
src/
  components/       Workspace, controls, panels, canvas and dialogs
  hooks/            Editor state and actions
  lib/              Geometry, persistence, font and export utilities
  App.tsx           Page composition and shared editor wiring
  main.tsx          React entry point
  style.css         Styles
  types.ts          Shared models
assets/
  fonts/            Included font and its licence
  licenses/         Third-party notices
tests/
  unit/             Vitest tests
  e2e/              Playwright browser tests
  helpers/          Static server for testing the built app
scripts/            Build tooling
docs/               Generated site published by GitHub Pages
.run/               Shared WebStorm run configurations
.idea/              Portable WebStorm project metadata
```

Commit the source, assets, tests, configuration, lockfile and rebuilt `docs/`.
The shared WebStorm files are explicitly allowed in `.gitignore`; personal IDE
state, dependencies, scratch files, environment files and test reports are ignored.
Keep personal library backups outside the repository or in the ignored `tmp/` folder.

## Phone layout

Phones use a viewport-sized canvas view without a scrolling page. The top bar
has separate Character, Font and Library actions, plus undo/redo, Save, Import
and Export. Library sits immediately before Save. Save uses the current name;
open Export to change the name or copy the character. Each action has its own panel.
Only a panel's contents scroll when needed.

Tap the floating tool button, then choose Draw, Erase, Cut area, Line or Points.
The same picker includes a Round/Square tip toggle and closes after a choice.
The bottom row has Guides, Brush size and Fit/Zoom. Tap Brush size to reset to
45; drag right/up to increase and left/down to decrease. Its icon shows the
Round/Square tip. Tap Fit/Zoom to reset the view, or drag to adjust zoom. Both
buttons also support arrow keys. Compact landscape uses a two-column picker.

At 100% the printable square uses the full phone width (or the available height
in landscape) and is centered above the controls. Zoom
supports up to 1600% and uses the entire rectangular drawing viewport. Pinch to
zoom and pan; an axis stays centered while the square fits on that axis. Once it
no longer fits, its pan range opens gradually and inward-moving edges stop at
the fit area. Pinch steps use the previous visible position so blocked movement
cannot accumulate.
The fit area only controls sizing and movement. Drawing fills the screen and
clips only at its outer boundary; toolbars are overlaid on top. Tap Fit/Zoom to return to 100%. The brush number is surrounded by the
selected tip shape; zoom has fit corners around its percentage. Both adjustment
buttons are 48 x 48 squares. Exports remain
cropped to the printable square.

The phone components are in `src/components/mobile/`; `src/mobile.css` controls
the phone layout. `src/hooks/useCompactLayout.ts` selects the layout while the
shared editor state preserves the current character across viewport changes.

## WebStorm

Shared run configurations are included in `.run/`. Open the repository folder
in WebStorm and choose a configuration from the Run/Debug dropdown:

| Configuration        | Action                                                      |
| -------------------- | ----------------------------------------------------------- |
| Development          | Starts Vite at http://127.0.0.1:4173 with hot reload        |
| Build GitHub Pages   | Type-checks and builds `docs/`                              |
| Preview GitHub Pages | Builds first, then serves `docs/` at http://127.0.0.1:4173  |
| Typecheck            | Runs the strict TypeScript checks                           |
| Unit Tests           | Runs Vitest                                                 |
| Browser Tests        | Builds first, then runs Playwright against the built folder |

They use the project's Node.js runtime and relative project paths. Select
Node.js 22.12 or newer in WebStorm's JavaScript Runtime settings and run
`npm install` once. Stop Development before starting Preview GitHub Pages,
because both use port 4173. Browser Tests use port 4174 and Microsoft Edge locally.
See [WebStorm's npm configuration documentation](https://www.jetbrains.com/help/webstorm/run-debug-configuration-npm.html)
for runtime and debugger settings.

## Build the GitHub Pages folder

```sh
npm run build
```

The script type-checks the app and creates **`docs/`**, containing `index.html`,
compiled JavaScript, CSS, the included Japanese font, licence notices and
`.nojekyll`. Everything needed to run the deployed app is inside that folder.
The build replaces its previous contents; edit the sources in `src/` and rebuild.

For GitHub Pages:

1. Run `npm run build`.
2. Commit and push the source changes, `package-lock.json`, and the entire `docs/` folder.
3. In the repository's **Settings → Pages**, choose **Deploy from a branch**.
4. Select **main** (or your default branch), choose **/docs**, and save.

The repository site will be at https://nikos-pap.github.io/kanji-maker/.
Run `npm run build` and commit the updated `docs/` after each source change.
The build uses relative asset URLs, so you can also publish the contents of
`docs/` on another static host or under another repository name.

To check the output locally:

```sh
npm run preview
```

Open http://127.0.0.1:4173. This serves the built `docs/` folder. Use an HTTP server
or GitHub Pages to run it; do not double-click the built HTML. No backend or
external CDN is required, and the font is included locally.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser tests serve only `docs/` under `/kanji-maker/`, exercising repository
paths, drawing, point edits, undo/redo, library persistence, imports and exports.
They use installed Microsoft Edge locally and Playwright Chromium on CI. If Edge
is unavailable, install it or use `CI=true` with `npx playwright install chromium`.

GitHub Pages does not sync or store your personal character library. Keep personal
app-file backups outside the repository unless you intend to share them.

## Your library and backups

The library, unfinished draft and character codes live in browser local storage,
not cookies. They belong to that browser profile and site origin. Updating the
page at the same address does not reset them. A different browser, website
address or clearing browser data can give you an empty library.

Before moving from the local file to the hosted site, **export App file (.json)**
from the old page and import it into the new page. Importing into an empty library
restores character codes and font identity. Importing into a populated library
adds independent copies with fresh codes. Keep app-file backups separately.

## Exports and copying

- **Word document (.docx):** the whole saved library as editable characters, with
  its font embedded. Desktop Word can display the document without a separate
  font installation.
- **Library font (.ttf):** one stable family with a distinct private-use code for
  each saved character. Install this for editable text pasted into other apps;
  update the installed font after changing or adding characters.
- **App file (.json):** editable outlines, cuts, strokes, names, font identity and
  character codes. Use this for backup and transfer.
- **Current character:** SVG, PNG, a separate single-character font, or an app
  file. SVG and PNG preserve transparent cuts.
- **Copy for document:** formatted text using the library font, or a transparent
  PNG. The image needs no font but is a picture. A text copy cannot install or
  embed its font through the clipboard. Keep source formatting when pasting text
  into Word.

Font export preserves native quadratic outlines where possible. Composed cuts,
added strokes and cubic outlines are traced at high resolution into TrueType
contours. SVG keeps the original vector curves and masks.

## Editing controls

Use **Points** for anchors and curve handles; move a connected contour by dragging
its boundary. Enter X/Y coordinates or nudge with arrows (Shift: 10 units,
Alt: 0.1). A connected outline may contain several strokes.

The tool order is **Draw, Erase, Cut area, Line, Points**. Draw, Erase and
Line share the **Round / Square** brush setting and Size. Square uses an
axis-aligned square tip, including on diagonal strokes. Cut area shows a live
rectangle while dragging; release to apply, or press Escape to cancel. Brush
shapes are retained in saved characters, backups and exports. Older backups,
including existing polygon cuts, remain readable.

On desktop, Guides, brush settings, zoom and Fit are grouped above the canvas. Usage hints
are available in button tooltips and Help.

Wheel zoom follows the pointer. Space+drag or middle mouse drag moves the
canvas; touch supports pinch zoom. Fit shows the whole character. Only the canvas
zooms. Shortcuts: D/E/R/L/N select tools, 0 fits, Ctrl+Z undoes,
Ctrl+Shift+Z redoes. Escape cancels an unfinished cut or point drag.

## Third-party licences

The included font is derived from Noto Serif CJK, © 2017–2024 Adobe, under the
SIL Open Font License in `assets/fonts/OFL.txt`. Fontkit's licence is in
`assets/licenses/fontkit-LICENSE.txt`. Both notices are copied into docs/licenses/ by the build. Uploaded fonts remain subject to their own licences.
