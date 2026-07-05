# PDF Toolkit — Suggestions & Reframed Plan (Draft)

> This is a **suggestions companion** to [pdf-editor-plan.md](pdf-editor-plan.md). It does not replace the original plan — it proposes changes for discussion.
>
> **Guiding constraints (from the project owner):** self-hosted, **no backend**, lightweight, open-source, free. Redaction is **a feature, not the main purpose**.

---

## 1. Repositioning

The original plan is redaction-first ("build a redaction app"). The new framing is:

> **A lightweight, fully client-side PDF toolkit** — view, organize, annotate, and convert PDFs entirely in the browser, with nothing ever uploaded. Redaction is one of its flagship features.

Why this matters:
- The app is **useful on day one** (viewer + page tools) instead of being blocked on getting redaction perfectly correct.
- Broadens the audience (most people want merge/split/reorder more often than redaction).
- Still keeps redaction as a differentiator — just not the sole identity.

**Action:** rewrite the "Why Build This?" and "North Star" sections around "lightweight private PDF toolkit," with redaction listed among the headline features.

---

## 2. Architecture: No Backend, Ever

The original plan introduces a Python/FastAPI + PyMuPDF + Tesseract backend in Phase 4. This conflicts with the "no backend / self-hosted / lightweight" constraint. Everything can run in-browser via WASM:

| Original "needs backend" feature | In-browser (WASM) replacement |
|---|---|
| OCR | **tesseract.js** (Tesseract compiled to WASM) |
| Compression | Canvas image downsampling, or **Ghostscript-wasm** / **qpdf-wasm** |
| Encryption / password | **qpdf-wasm** |
| Image → PDF | **pdf-lib** (trivial) |
| True redaction | **mupdf-wasm** *or* rasterize-the-region (see §3) |
| Word → PDF | Hardest case — consider deferring or dropping (see §6) |

**Result:** the entire app is **static files**. "Self-hosting" becomes "copy the folder to any static host (or open `index.html` locally)." No Docker, no Python runtime — a concrete advantage over Stirling PDF.

```
All phases: 100% in-browser (static site / PWA)
            React + PDF.js + pdf-lib + (Konva) + WASM modules (lazy-loaded)
            No server. No uploads. Optionally packaged as a Tauri desktop app.
```

---

## 3. Redaction Correctness — A Real Risk to Resolve Early

The original plan says: *use pdf-lib to draw a black rectangle and remove the underlying content.*

**Problem:** pdf-lib can draw shapes on top of a page, but it **cannot** surgically remove text/image content at a given coordinate. So a pdf-lib-only "redaction" is exactly the insecure black box the plan warns about — the text is still in the file underneath.

Two no-backend ways to do it *correctly*:

1. **Rasterize the redacted region (or whole page).** Render the page with PDF.js, paint black boxes, and replace that page/region with a flat image embedded via pdf-lib. The original data is genuinely gone. **Trade-off:** that page is no longer selectable/searchable text.
2. **mupdf-wasm (mupdf.js).** Artifex's MuPDF compiled to WebAssembly runs fully in-browser and supports *true* content-removal redaction (PyMuPDF-quality) with no server. **Trade-off:** **AGPL licensing** (see §4).

**Recommendation:** prototype both early. Default to rasterize for an MIT-friendly build; offer mupdf-wasm if you accept AGPL. Either way, **add an automated test that extracts text from the output and asserts the secret string is absent.**

---

## 4. Pick a License Deliberately

"Open source and free" needs an actual license, and the dependency licenses constrain your choice:

- **Permissive (MIT/Apache):** PDF.js (Apache-2.0), pdf-lib (MIT), Fabric/Konva (MIT), tesseract.js (Apache-2.0). Lets you license your app MIT.
- **Copyleft (AGPL/commercial dual):** mupdf-wasm, Ghostscript. Pulling these in generally forces your **whole app to AGPL**.

**Decision needed:** MIT-permissive (avoid AGPL deps — use rasterized redaction, qpdf for compression/encryption) **vs.** AGPL-copyleft (gain mupdf's true redaction + Ghostscript compression). Choose before building Phase 1, since it shapes the dependency set.

---

## 5. Lightweight & Performance Choices

- **Konva.js over Fabric.js.** Fabric is heavy; Konva is lighter and faster for the draw/resize-boxes use case. (Or a thin custom overlay layer if you want minimal deps.)
- **Web Workers for all heavy work** — pdf-lib writes, OCR, compression, rasterization. Keeps the UI responsive; critical for the "feels lightweight" goal.
- **Virtualized page rendering** — render only on-screen pages so a 500-page PDF doesn't choke the tab.
- **Lazy-load each tool/WASM module** — keep the initial bundle tiny; download the OCR/compression WASM only when used.
- **Set a bundle-size budget** and track it in CI.
- **PWA** — service worker for true offline use and installability.
- **Optional desktop packaging with Tauri** (Rust shell, ~MBs) rather than Electron (~100MB+), if a desktop build is wanted.
- **File System Access API** (Chromium) for open/save-in-place; graceful fallback to download for Firefox/Safari.

---

## 6. Revised Feature Roadmap (reordered for value & ease)

Lead with simple, high-frequency, easy-in-browser wins to build momentum.

### Phase 1 — Viewer + Page Organizer (the everyday toolkit)
- PDF viewer: render, zoom, scroll, page navigation, thumbnails
- Page management: reorder, rotate, delete, **extract** pages (drag-and-drop thumbnails)
- **Merge** PDFs / **Split** PDF — among the most-used utilities, easy with pdf-lib
- Image → PDF
- Open via drag-and-drop + File System Access API

### Phase 2 — Annotation
- Highlight / underline / strikethrough
- Freehand drawing, text boxes, sticky notes/comments
- Undo/redo (annotation state history)

### Phase 3 — Redaction (flagship feature)
- Draw/resize/delete redaction boxes (Konva overlay)
- **Correct** burn-in (rasterize region or mupdf-wasm — see §3)
- Post-redaction text-extraction verification test
- (Later) AI-assisted detection of names/emails/phone numbers/IDs via in-browser regex + optional small WASM NER model — still no server

### Phase 4 — Conversion & Security (all in-browser/WASM)
- Compress (canvas downsample / Ghostscript- or qpdf-wasm)
- Password protect / encrypt (qpdf-wasm)
- OCR scanned PDFs (tesseract.js) → searchable + redactable
- Form filling (pdf-lib form API)
- Word → PDF: **decide whether it's worth it** — high effort in-browser; may be out of scope for a "lightweight" tool

---

## 7. Trust as a Feature

The strongest differentiator is provable privacy:
- **Strict CSP** with no external network origins (and document that users can confirm zero uploads in the browser's network tab).
- Visible **"100% offline / nothing uploaded"** indicator.
- Works fully offline as a PWA — the proof that nothing is server-side.

---

## 8. Smaller Notes

- **Keyboard shortcuts** and basic **accessibility** (focus management, ARIA on toolbars) from the start — cheap if done early, painful to retrofit.
- **Error handling** for encrypted/corrupt/huge PDFs — surface clear messages instead of a frozen tab.
- **Sample test PDFs** (text, scanned, forms, encrypted, 500-page) committed to the repo for consistent manual + automated testing.
- **Don't over-commit the week-by-week timeline** in the original plan; treat milestones as ordered, not dated.

---

## Open Questions for the Owner

1. **License direction:** MIT-permissive (rasterized redaction) or AGPL (mupdf true redaction)?
2. **Desktop app wanted** (Tauri), or browser/PWA only?
3. Is **Word ↔ PDF conversion** in scope, given it's the one feature that's genuinely hard without a backend?
4. **AI-assisted redaction** — acceptable as in-browser regex/WASM only (no API calls), to preserve the no-backend/private promise?
