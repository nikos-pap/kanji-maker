# Kanji Maker

A standalone Japanese glyph editor. Start from a font character, change its
outline, and save your variants in a browser library. Export editable Word
documents, reusable fonts, app backups, SVGs and PNGs.

Open **kanji_maker.html** directly in a browser. It includes the editor and its
Japanese font, so it works offline without an installation or server.

## Editing the app

This repository is independent of the Japanese N5 editor. All required sources
and assets are included here:

| File | Purpose |
| --- | --- |
| `src/index.html` | Page layout and help text |
| `src/style.css` | Appearance and responsive layout |
| `src/app.js` | Editing, library, clipboard and interaction |
| `src/exports.js` | TrueType font and Word document generation |
| `assets/fonts/` | Included Japanese font and its licence |
| `assets/vendor/` | Bundled fontkit and its licence |
| `scripts/build.cjs` | Builds the self-contained page |
| `kanji_maker.html` | Generated page; commit this after building |
| `index.html` | GitHub Pages entry; opens the generated page |

Use Node.js 18 or newer. There are no packages to install.

1. Edit the files in `src/`.
2. Run `npm run build` from this folder.
3. Open `kanji_maker.html`, or run `npm start` for a preview at
   **http://127.0.0.1:4173**. Stop the preview with Ctrl+C.
4. Run `npm test` to check the generated file matches its sources.
5. Commit the changed sources **and** `kanji_maker.html`, then push.

`npm start` rebuilds before starting. To use another port, set `PORT`.
The GitHub check catches a generated page that was not rebuilt. It checks build
consistency; it does not replace testing the editor in a browser.

Do not edit the generated HTML by hand: the next build replaces it. The build
normalizes line endings so Windows and GitHub generate the same output.

## GitHub Pages

In the repository on GitHub, open **Settings → Pages**. Choose **Deploy from a
branch**, then **main** and **/ (root)**, and Save. If your default branch has a
different name, choose that branch instead.

The expected address for this repository is
**https://nikos-pap.github.io/kanji-maker/** once Pages is enabled and deployed.
The entry page uses a relative link, so it also works in other repository paths
and on custom domains. The existing `kanji_maker.html` address continues to work.
After setup, pushing an updated generated page updates the site.

Pages serves static files. It does not sync or store your personal character
library. Repository contents are accessible with the published site; keep
personal library exports outside the repository unless you intend to share them.

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
Alt: 0.1). A connected outline may contain several strokes. Erase, rectangle cut
and polygon cut remove areas; Draw and Line add strokes. Undo reverses edits.

Wheel zoom follows the pointer. Space+drag, middle mouse drag or Pan moves the
canvas; touch supports pinch zoom. Fit shows the whole character. Only the canvas
zooms. Shortcuts: N/E/R/P/D/L/H select tools, 0 fits, Ctrl+Z undoes,
Ctrl+Shift+Z redoes. Escape cancels an unfinished cut or point drag.

## Third-party licences

The included font is derived from Noto Serif CJK, © 2017–2024 Adobe, under the
SIL Open Font License in `assets/fonts/OFL.txt`. Fontkit's licence is in
`assets/vendor/fontkit-LICENSE.txt`. Both notices are bundled into the generated
page. Uploaded fonts remain subject to their own licences.
