# Kanji Maker

A React and TypeScript Japanese glyph editor, built with Vite. Start from a font
character, edit its outline, and save variants in a browser library. Export Word
documents, reusable fonts, app backups, SVGs and PNGs. A separate composer builds
characters from movable radicals and individual strokes.

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
| `src/components/composer/`             | Radical and stroke picker, canvas, crop controls and page      |
| `src/hooks/useComposition.ts`          | Composition history and independent editable draft             |
| `src/lib/composition.ts`               | Component transforms, source crops and project validation      |
| `src/lib/compositionExport.tsx`        | Vector SVG export and transfer to the character editor         |
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

## Radical and stroke composer

Open **Radicals & strokes** from the desktop header, or open **Tools → Build**
on a phone. The separate React page uses `#compose`, so direct links work on
GitHub Pages without server routing. The original editor is at `#editor`.

- Add any of the 214 canonical radicals, grouped from 1 to 17 strokes, or one
  of the 13 additional variant forms. Search by character, English name or radical
  number. Custom characters and built-in stroke shapes are also available.
- Select and drag a component to move it. Use its handles or Width/Height fields
  to resize it independently. Shift keeps corner resizing proportional on desktop.
- Choose **Crop** and drag a handle to trim the source. Drag inside the crop to
  move the crop window. The four Crop fields give exact percentages; Reset crop
  restores the full source. Resizing preserves the chosen crop.
- Use the bottom component strip to select overlapping pieces. Component settings
  include Duplicate, Remove, Bring forward and Send backward.
- Undo/redo is independent of the drawing editor. Arrow keys nudge a selected
  component; Shift moves by 10 units. Delete removes it. Escape cancels a drag.

The composition draft is saved separately in browser storage. The component panel
starts with the composition name. Save is in the top bar on desktop and phone. Move/resize and
Crop live only in the central toolbar. Numeric fields ignore wheel changes.

The composer shares the drawing editor's library. Saving retains the original
components, sizes, positions and crops, plus the assembled glyph used by Word and
font exports. Opening a composition restores its editable pieces; opening an
ordinary saved character creates one full-size component. Saving an opened item
updates its existing character code. Library backups also retain editable pieces.
Both editors use the same Library popup. Each saved character has an export button
beside it; this opens a smaller dialog above the library with SVG and PNG choices
and one Export button. SVG preserves source curves and crops; PNG is transparent
at 2048 pixels. Import stays in the drawing editor's top bar, outside the library.

**Preview** in the central toolbar opens a popup with the composition beside fixed
kanji samples at several text sizes. A temporary font contains both the composed
glyph and the reference kanji, so it tests actual text placement and baseline. The
font is removed from the page when the popup closes.

SVG downloads preserve each source curve and crop. **Editor** opens the assembled
glyph in the drawing editor. Cropped or overlapping pieces are merged at 2048
pixels for this handoff; the editable composition remains available in its draft
and library entry. Disjoint uncropped pieces keep their native curves.

Radical numbers, names and ideograph equivalents follow the Unicode Kangxi set;
see [Unicode's radical mappings](https://www.unicode.org/Public/17.0.0/ucd/CJKRadicals.txt).
The generated data notice is in `assets/licenses/unicode-LICENSE.txt` and is copied
to the built site's `licenses/` directory.

On phones the canvas fills the main view. Add and Component settings open sheets;
only sheet contents and the horizontal component strip scroll. Sheet headings
and close buttons stay fixed above their scrolling contents.

## Phone layout

Phones use a viewport-sized canvas view without a scrolling page. The top bar
has separate Character, Font and Library actions, plus undo/redo, Save, Import
and Export. Library sits immediately before Save. Save uses the current name;
open Export to change the name or copy the character. Each action has its own panel.
Only a panel's contents scroll when needed.

Tap the floating tool button, then choose Draw, Erase, Cut area, Line or Points.
The same picker includes a Round/Square tip toggle and closes after a choice.
The bottom row has Guides, a horizontal Brush size slider and an icon-only Fit/Zoom
button. The slider shows the Round/Square tip and current size. Tap Fit/Zoom to
reset the view, or drag to adjust zoom. Both controls also support arrow keys.
Compact landscape uses a two-column picker.

At 100% the printable square uses the full phone width (or the available height
in landscape) and is centered above the controls. Zoom
supports up to 1600% and uses the entire rectangular drawing viewport. Pinch to
zoom and pan; an axis stays centered while the square fits on that axis. Once it
no longer fits, its pan range opens gradually and inward-moving edges stop at
the fit area. Pinch steps use the previous visible position so blocked movement
cannot accumulate.
The fit area only controls sizing and movement. Drawing fills the screen and
clips only at its outer boundary; toolbars are overlaid on top. Tap Fit/Zoom to
return to 100%. Zoom uses the same icon size as its peers, with its current value
available to assistive technology. The zoom and tool picker buttons share the
leftmost Guides button's shape. Exports remain cropped to the printable square.

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
- **Saved character:** SVG or PNG from its library row. Both preserve transparent cuts.
- **Current character:** a separate single-character font or an app file.
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
