# PDF Toolkit — MVP Plan (Phase 1)

> **Scope of this document:** Phase 1 only. A lightweight, fully client-side PDF viewer for **desktop browsers**, with exactly four capabilities: **open/view PDFs, highlight text, sign PDFs, merge PDFs**. Everything else (redaction, OCR, compression, page management, mobile) is explicitly deferred.
>
> Supersedes the Phase 1 sections of [pdf-editor-plan.md](pdf-editor-plan.md) and [pdf-editor-plan-suggestions.md](pdf-editor-plan-suggestions.md).

---

## Product Definition

**A static web app.** No server, no uploads, no accounts. Open a PDF from disk, read it comfortably, highlight passages, drop in a signature, merge files, save the result back to disk. It should feel faster and lighter than opening Acrobat.

**Target:** desktop Chrome/Edge/Firefox/Safari (current versions). Mobile is out of scope for the MVP — the UI can assume a mouse, a keyboard, and screen width.

**Non-goals for Phase 1** (deferred, not rejected):
- Redaction (and therefore the MIT-vs-AGPL / mupdf decision — see *Decisions* below)
- Page management (reorder/rotate/delete/extract), split, compress
- OCR, form filling, conversions, encryption
- Sticky notes, freehand drawing, text boxes
- Cryptographic/digital signatures (see *Feature 3* for what "sign" means here)
- PWA/offline install and Tauri desktop packaging (architecture stays compatible; we just don't build them yet)

---

## The Four Features

### 1. Open & View PDFs
- Open via file picker and drag-and-drop; File System Access API in Chromium for open/save-in-place, download fallback for Firefox/Safari.
- Continuous scroll rendering with zoom (fit-width / fit-page / %), page navigation, and a thumbnail sidebar.
- **Virtualized rendering:** only render pages near the viewport; **release page bitmaps aggressively** once off-screen so a 500-page scanned PDF doesn't exhaust tab memory.
- **Text layer enabled from day one** (PDF.js text layer). It's required for text selection → highlights, and for in-document search later.
- **Password-protected input files:** PDF.js can decrypt for viewing, so *viewing* encrypted PDFs (with the user's password) is in scope. *Editing* them (highlight/sign/merge) is **out of scope for MVP** — detect and show a clear "viewing only — encrypted PDF" notice rather than producing corrupt output.
- Clear error states for corrupt/unsupported files instead of a frozen tab.

### 2. Highlights
- User selects text via the PDF.js text layer; the app converts the selection's rectangles into highlight quads.
- Highlights are written into the saved PDF as **real `/Highlight` annotations** (color + quad points), not flattened rectangles — they stay standard, visible in other viewers, and removable later. pdf-lib has no high-level highlight API, so this uses its low-level annotation dictionaries; budget time for it (see Milestone 3).
- Color picker (small fixed palette is fine), delete highlight, and **undo/redo** for annotation actions.
- Highlights live in app state until the user saves; saving produces a new PDF file (see *Saving* below).

### 3. Sign PDFs
- **Scope = visual signature**, the thing most people mean: place an image of a signature on the page. **Not** a cryptographic digital signature (no certificates, no signing chain) — the UI must not claim legal/digital-signature status.
- Three ways to create a signature: **draw** (canvas, saved with transparent background), **type** (rendered in a script-style font), **upload** an image (PNG with transparency preferred).
- Place, move, and resize the signature on any page; on save it is embedded as an image via pdf-lib and flattened into the page content.
- Persist created signatures in `localStorage` (image data only, on the user's machine) so repeat signing is one click.

### 4. Merge PDFs
- Select multiple files, reorder them in a simple list (per-file thumbnails of the first page), merge with pdf-lib's page copying, save the result.
- Encrypted inputs are rejected with a clear message (same MVP rule as above).
- Runs in a **Web Worker** so a 200MB merge doesn't freeze the UI; show progress.

### Saving
- All edits produce a **full rewrite** of the document (pdf-lib's default), not an incremental update.
- Save via File System Access API (save-in-place or Save As) in Chromium; download fallback elsewhere. Never silently overwrite — in-place saves require an explicit user action.

---

## Tech Stack

| Choice | Role | Notes |
|---|---|---|
| **TypeScript** | Everywhere | This project is mostly coordinate math and binary-format plumbing; types are not optional. |
| **React + Vite** | UI shell | Standard, fast. |
| **PDF.js** (Apache-2.0) | Rendering, text layer, decryption for viewing | Battle-tested (Firefox's viewer). |
| **pdf-lib** via the **`@cantoo/pdf-lib` fork** (MIT) | Writing: highlights, signature embed, merge | Upstream pdf-lib is unmaintained (last release ~2021); the Cantoo fork is maintained. If we hit a wall in its annotation/encryption gaps, that's an early signal, not a late surprise. |
| **Plain DOM/SVG overlay** for signature placement | Move/resize one image on a page | We do **not** need Konva or Fabric for the MVP. Highlights come from text selection (no drawing), and signature placement is one draggable/resizable box. Adopt Konva later only if Phase 2 annotation tools demand it. |
| **Tailwind CSS** | Styling | Keep the UI clean and small. |
| **Web Workers** | Merge, save/rewrite of large files | UI thread renders; workers do byte work. |

**License: MIT.** Nothing in the MVP needs an AGPL dependency (no mupdf, no Ghostscript). The MIT-vs-AGPL question only reopens when redaction is scheduled.

**Bundle discipline:** set a bundle-size budget now and track it in CI. Lazy-load the merge and signature modules; the initial load is viewer-only.

---

## Known Hard Parts (named up front)

1. **Coordinate mapping — do this as a spike before building features on it.** Converting between the rendered canvas / text layer (top-left origin, CSS pixels, zoom) and PDF user space (bottom-left origin, points, page **rotation**, non-zero **CropBox**) is the classic source of "annotation landed in the wrong place" bugs. Both highlights and signature placement depend on it. Build one well-tested transform module (Milestone 2) and route everything through it.
2. **Low-level highlight annotations in pdf-lib.** No high-level API exists; we write annotation dictionaries by hand. Prototype early in Milestone 3 — if it's miserable, the fallback (flattened translucent rects) is acceptable for MVP but should be a conscious decision.
3. **Memory on large documents.** Virtualization plus explicit bitmap release, and workers holding only one copy of the file bytes. Test with the 500-page scanned sample from the corpus below, and watch tab memory.

---

## Test Corpus & Verification

Commit a set of sample PDFs to the repo and use them in both manual and automated tests:

- Simple text PDF; multi-column text PDF (selection→quad edge cases)
- **Rotated pages** (90°/270°) and a **non-zero CropBox** document — the coordinate-mapping tests
- 500-page scanned PDF (memory/virtualization)
- Password-protected PDF (view-only path + graceful edit rejection)
- Corrupt/truncated PDF (error handling)

Automated checks (Vitest + Playwright):
- **Round-trip test:** open → highlight → save → re-open in PDF.js *and* extract annotations — quads land on the selected text, on rotated/CropBox pages too.
- **Merge test:** page counts and page order of output match the input list.
- **Signature test:** saved output contains the image XObject on the right page at the right rect.
- Bundle-size budget check in CI.

---

## Milestones (ordered, not dated)

1. **M0 — Scaffold & viewer core.** Vite + React + TS + Tailwind; PDF.js rendering with zoom/navigation/thumbnails; virtualized pages with bitmap release; file open (picker + drag-drop + FS Access API); error states; encrypted-PDF view-only path.
2. **M1 — Coordinate transform module (spike → library).** The canvas↔PDF-space transform with rotation and CropBox handled, plus its test suite against the corpus. Nothing that writes to a PDF starts before this lands.
3. **M2 — Highlights.** Text-layer selection → quads → overlay preview; annotation state with undo/redo; save as `/Highlight` annotations via pdf-lib (prototype the low-level path first); round-trip tests.
4. **M3 — Sign.** Signature creation (draw/type/upload), localStorage persistence, DOM-overlay placement, embed + flatten on save.
5. **M4 — Merge.** Multi-file list UI with reordering, worker-based merge with progress, tests.
6. **M5 — Polish & ship.** Keyboard shortcuts (zoom, page nav, undo/redo) and toolbar accessibility (focus management, ARIA); strict CSP with no external origins + visible "nothing leaves your machine" indicator; bundle budget enforced; deploy as static files.

---

## Trust as a Feature (kept from the suggestions doc)

- **Strict CSP** with no external network origins; document that users can verify zero uploads in the network tab.
- Visible **"100% local — nothing uploaded"** indicator in the UI.
- The app is plain static files: hosting it yourself is copying a folder.

---

## Decisions Made / Deferred

| Decision | Status |
|---|---|
| License | **MIT** — nothing in the MVP needs AGPL. Revisit only when redaction is scheduled. |
| Canvas library | **None for MVP** (DOM/SVG overlay). Konva reconsidered in Phase 2. |
| "Sign" meaning | **Visual signature only**; cryptographic signing deferred indefinitely. |
| Encrypted PDFs | View-only in MVP; editing them deferred (likely via qpdf-wasm decrypt later). |
| Redaction approach (rasterize vs mupdf) | **Deferred** with the redaction feature itself; MIT choice keeps both doors open. |
| PWA / Tauri | Deferred; architecture (static files, no server) stays compatible. |
| Word→PDF | Dropped (out of scope for a lightweight tool). |
