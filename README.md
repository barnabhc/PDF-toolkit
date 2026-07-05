# PDF Toolkit

A lightweight, fully client-side PDF toolkit for desktop browsers. Open a PDF, highlight text, place your signature, merge files — **entirely in your browser**. No server, no uploads, no accounts: the production build ships a strict Content-Security-Policy with no external origins, so you can verify in the network panel that nothing ever leaves your machine.

This is the Phase 1 MVP described in [pdf-mvp-plan.md](pdf-mvp-plan.md).

## Features

- **View** — continuous scroll with zoom / fit-width, page navigation, thumbnail sidebar. Pages are virtualized and bitmaps released off-screen, so large documents stay usable. Password-protected PDFs open in view-only mode.
- **Highlight** — pick the highlighter, select text, done. Written into the saved file as real `/Highlight` annotations (with appearance streams), so they show up in other viewers and remain removable. Undo/redo included.
- **Sign** — draw, type, or upload a signature image, place and resize it on any page; flattened into the page on save. Signatures are remembered in `localStorage`. *This is a visual signature, not a cryptographic digital signature.*
- **Merge** — combine PDFs in any order; runs in a Web Worker with progress.

Saving always produces a full rewrite via a save dialog / download — never a silent overwrite. The open document's bytes are kept pristine, so saving is idempotent and editing can continue afterwards.

## Install it as an app (easiest — no technical skills needed)

PDF Toolkit is an installable web app (PWA). Once the project is published on GitHub, every push to `main` automatically deploys it to a public link via GitHub Pages — visit that link once and you can install it like normal software. Even though it comes from a link, **your PDFs are never uploaded anywhere**: the app runs 100% on your device and keeps working with the internet off.

### Install it (Chrome or Edge, Windows / Linux / macOS)

1. Open the app's link in **Chrome** or **Edge**.
2. Click the **install icon** at the right end of the address bar (a little screen with a down-arrow — or menu **⋮ → Cast, save and share → Install app**).
3. Click **Install**. The app opens in its own window and appears in your Start menu / app launcher like any other program. That's it — it now works even offline.

### Make it your default PDF opener (optional)

After installing:

1. **Right-click any PDF file** on your computer → **Open with** → **Choose another app**.
2. Pick **PDF Toolkit** from the list and tick **Always** (Windows) / set as default (Linux).
3. The first time a file opens this way, the app asks *"Open .pdf files with PDF Toolkit?"* — click **Allow**, and optionally "Always allow".

From then on, double-clicking any PDF opens it straight in PDF Toolkit.

> **Notes:** installing and default-opening need Chrome or Edge (Firefox and Safari can use the website normally, but can't install it as a file handler). To update, do nothing — the app updates itself next time you open it online. To uninstall, right-click its icon → Uninstall, like any app.

### For the repo owner: turning on the public link

One-time setup after pushing this project to GitHub: repository **Settings → Pages → Source: GitHub Actions**. The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs the tests, builds, and publishes on every push to `main`. Your link will be `https://<username>.github.io/<repo-name>/` — put it at the top of this README.

## Run it from source (Windows / Linux)

Prefer not to use the hosted link, or want to hack on it? The steps below run the same app from a tiny local server on your own machine.

### Step 1 — Install Node.js (one-time)

Node.js is the free program that runs the local server. You only do this once.

**Windows**
1. Go to <https://nodejs.org> in your browser.
2. Click the big green **LTS** download button and open the downloaded file.
3. Click **Next** through the installer, accepting the defaults, then **Finish**.

**Linux (Ubuntu/Debian and similar)**
1. Open the **Terminal** app.
2. Copy-paste this line and press Enter (it installs `nvm`, a Node.js installer):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   ```
3. Close the terminal, open a new one, then run:
   ```bash
   nvm install --lts
   ```

To check it worked, type `node --version` in a terminal (Windows: press the Windows key, type `cmd`, press Enter to get one). You should see a version number like `v24.x.x`.

### Step 2 — Get the app's files (one-time)

1. On this project's GitHub page, click the green **Code** button, then **Download ZIP**.
2. Find the downloaded ZIP file and extract it:
   - **Windows:** right-click → **Extract All…** — for example to `Documents\pdf-toolkit`.
   - **Linux:** right-click → **Extract Here**, or `unzip` it in a terminal.

(If you use Git: `git clone <repository-url>` does the same thing.)

### Step 3 — Set it up (one-time)

1. Open a terminal **in the app's folder** (the one containing `package.json`):
   - **Windows:** open the extracted folder in File Explorer, click the address bar, type `cmd`, press Enter.
   - **Linux:** right-click inside the folder → **Open Terminal Here** (or `cd` to it).
2. Run this command and wait for it to finish (it downloads the app's components — needs internet this one time):
   ```bash
   npm install
   ```

### Step 4 — Start the app (every time you want to use it)

In that same folder's terminal, run:

```bash
npm run dev
```

Leave that window open, then visit **http://localhost:5173** in your browser (Chrome or Edge recommended — they show proper Save dialogs; on Firefox, saved PDFs go to your Downloads folder instead).

Drag a PDF into the window and you're off. When you're done, close the browser tab and press `Ctrl+C` in the terminal (or just close it).

### Troubleshooting

- **“`npm` is not recognized / command not found”** — Node.js isn't installed or the terminal was open during installation. Reinstall from Step 1, then open a **new** terminal.
- **The `npm install` step shows red errors** — check your internet connection and run it again; it's safe to repeat.
- **The page doesn't load** — make sure the `npm run dev` terminal is still open, and that the address is exactly `http://localhost:5173`.
- **Something else is using port 5173** — the terminal will say so and pick the next port (e.g. 5174); use the address it prints.
- **Don't double-click `index.html`** — browsers block apps opened straight from a file; always start it with `npm run dev` (or see below).

<details>
<summary><strong>Optional: a faster way for everyday use (no dev server)</strong></summary>

After Step 3, run `npm run build` once. This creates a `dist/` folder of plain static files — the whole app, ready to serve. From then on you can start the app with:

```bash
npm run preview
```

and open the address it prints (http://localhost:4173). The same `dist/` folder is also exactly what you'd upload to any free static host (GitHub Pages, Netlify, Cloudflare Pages) to share the app with others — there is no server-side code at all.

</details>

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run build      # type-check + production build (dist/ is plain static files)
npm run smoke      # headless end-to-end smoke test (builds, then drives real Chromium)
npm run verify:pwa # checks manifest, file_handlers, service worker, offline load
npm run samples    # generate samples/sample.pdf (includes a rotated page)
```

The smoke test needs Playwright's Chromium: `npx playwright install chromium` (plus system libraries on minimal machines — `npx playwright install-deps chromium` with sudo, or extract `libnspr4`/`libnss3`/`libasound2t64` etc. locally and point `LD_LIBRARY_PATH` at them).

## Architecture

```
src/
  lib/coords.ts            ← THE coordinate module: CSS px ↔ PDF user space
                             (rotation + CropBox). Everything that writes to
                             a PDF goes through it. Heavily unit-tested.
  lib/pdf/highlights.ts    ← hand-built /Highlight annotation dictionaries + /AP
  lib/pdf/signatures.ts    ← image embed + counter-rotation placement math
  lib/pdf/merge.ts         ← pure merge, run inside workers/merge.worker.ts
  lib/pdf/saveDocument.ts  ← original bytes + annotations → new PDF (lazy-loaded)
  lib/loadDocument.ts      ← pdf.js loading, password prompt, page geometry
  lib/selectionHighlights.ts ← browser text selection → per-page highlight quads
  state/annotations.ts     ← undo/redo reducer over annotation snapshots
  context/EditorContext.tsx← app state, shortcuts, open/save orchestration
  components/              ← Toolbar, Viewer, PageView, overlays, modals
```

- **Rendering**: pdf.js (`pdfjs-dist`) with its text layer for selection.
- **Writing**: `@cantoo/pdf-lib` (maintained fork of pdf-lib), dynamically imported so the initial bundle stays viewer-only.
- **No canvas framework**: highlights come from text selection and signature placement is one draggable box — a plain DOM overlay is enough.

## Keyboard shortcuts

`Ctrl/⌘+O` open · `Ctrl/⌘+S` save · `Ctrl/⌘+Z` / `Ctrl/⌘+Y` undo/redo · `+`/`-` zoom · `Delete` remove selected annotation · `Esc` cancel/deselect

## MVP limitations (deliberate)

- Encrypted PDFs are **view-only** (editing them is deferred).
- Signatures are visual, not cryptographic.
- Desktop-first; mobile is out of scope for now.
- Redaction, page management, OCR, compression, forms: later phases — see the plan documents.

## License

MIT (all dependencies are MIT/Apache-2.0; no AGPL components).
