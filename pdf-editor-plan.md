# PDF Editor App — Project Plan

> **Goal:** Build a local-first, privacy-respecting PDF editor web app focused on redaction, with no paywalls and no file uploads to external servers. A lean, clean alternative to Adobe Acrobat.

---

## Why Build This?

Adobe Acrobat charges ~$20/month for features that should be free. Existing free tools either:
- Have watermarks or page limits (iLovePDF, AI-Redact)
- Upload your files to their servers (privacy risk)
- Have poor PDF rendering (LibreOffice Draw)
- Are self-hosted and ugly (Stirling PDF)

**The gap:** A clean, fast, browser-based PDF tool that runs entirely on your machine, with a good UI — starting with redaction.

---

## Competitive Landscape

| Tool | Strengths | Weaknesses |
|---|---|---|
| **Adobe Acrobat Pro** | Best-in-class, every feature | ~$20/month, bloated |
| **Stirling PDF** | Open-source, 50+ tools, self-hostable | Ugly UI, requires self-hosting |
| **iLovePDF / PDF24** | Breadth of tools, free tier | Watermarks, file size limits, files go to their servers |
| **AI-Redact** | AI-powered, no signup | Free only up to 4 pages |
| **LibreOffice Draw** | Fully offline, open-source | Breaks PDF formatting, impractical for redaction |
| **PDF-XChange Editor** | Deep features, ~$56/year | Windows only |

**Our edge:** Local-first (no file uploads), clean UI, free, focused feature set.

---

## Feature Roadmap

Features are ordered by usage frequency and build priority.

### Phase 1 — MVP (Core Redaction App)
*Goal: Ship something usable. This alone beats what most people pay for.*

- [ ] **PDF Viewer** — render PDFs in the browser, zoom, page navigation
- [ ] **Redaction Tool** — draw black boxes over sensitive content, permanently burn them into the file
- [ ] **Download Redacted PDF** — output a clean, flattened PDF

### Phase 2 — Annotation & Basic Editing
*Goal: Cover the most common Acrobat daily-use features.*

- [ ] **Highlight / Underline / Strikethrough** text
- [ ] **Sticky Notes & Comments** — add review annotations
- [ ] **Freehand Drawing** — markup tool
- [ ] **Text Boxes** — add text anywhere on the page
- [ ] **Page Management** — reorder, delete, rotate pages

### Phase 3 — Document Operations
*Goal: Replace the utility tools people use Acrobat for.*

- [ ] **Merge PDFs** — combine multiple PDFs into one
- [ ] **Split PDF** — extract pages or ranges into new files
- [ ] **Compress PDF** — reduce file size
- [ ] **Form Filling** — fill existing PDF form fields

### Phase 4 — Advanced Features
*Goal: Match Acrobat Pro's power-user capabilities.*

- [ ] **OCR (Optical Character Recognition)** — make scanned PDFs searchable and redactable
- [ ] **e-Signatures / Digital Signatures** — sign documents
- [ ] **Password Protection / Encryption** — lock PDFs
- [ ] **Convert to/from PDF** — Word ↔ PDF, image → PDF
- [ ] **AI-Assisted Redaction** — auto-detect sensitive info (names, phone numbers, IDs) and suggest redactions

---

## Tech Stack

### What You Need to Learn

#### Frontend
| Technology | Purpose | Priority |
|---|---|---|
| **React** | Build the UI — editor panels, toolbars, page viewer | 🔴 Must know |
| **PDF.js** (Mozilla) | Render PDFs in the browser as a canvas/SVG | 🔴 Must know |
| **Fabric.js** or **Konva.js** | Draw redaction boxes and annotations on top of the PDF canvas | 🔴 Must know |
| **Tailwind CSS** | Styling — fast, utility-first, clean UI | 🟡 Helpful |

#### PDF Manipulation (the hard part)
| Technology | Purpose | Priority |
|---|---|---|
| **pdf-lib** (JS) | Modify and write PDFs in the browser — permanently burns redactions into the file | 🔴 Must know |
| **pdfmake** | Generate new PDFs from scratch (less critical for redaction) | 🟢 Optional |

#### Backend (only needed for advanced features like OCR)
| Technology | Purpose | Priority |
|---|---|---|
| **Python + FastAPI** | Lightweight API server for heavy processing | 🟡 Phase 4 |
| **PyMuPDF (fitz)** | Best Python library for PDF manipulation; natively supports redaction | 🟡 Phase 4 |
| **Tesseract** | Open-source OCR engine — makes scanned PDFs searchable | 🟢 Phase 4 |

### Architecture Decision

```
Phase 1–3:  100% in-browser
            React + PDF.js + pdf-lib + Fabric.js
            No server. No file uploads. Pure privacy.

Phase 4:    Optional local Python server (FastAPI)
            Runs on localhost — files never leave the machine
            Handles OCR, conversion, compression
```

### Why This Stack?
- **No backend required for MVP** — everything runs in the browser
- **pdf-lib** is the key piece: it lets you *write* a permanent redaction into the PDF file (not just paint over it visually)
- **PDF.js** is battle-tested (used by Firefox's built-in PDF viewer)
- **Fabric.js** makes drawing/selecting boxes on a canvas very straightforward

---

## How Redaction Actually Works (Important)

Redaction is not just drawing a black box on screen. True redaction has two steps:

1. **Mark** — user draws a box over sensitive content on the canvas (Fabric.js)
2. **Burn / Flatten** — the underlying text/image data at that location is *permanently removed* from the PDF, and a solid black rectangle is written in its place (pdf-lib)

> ⚠️ If you skip step 2, anyone can remove the black box and read the original text. Adobe Acrobat's "redaction" feature specifically handles this — your app must too.

---

## Development Milestones

### Milestone 1 — PDF Viewer (Week 1–2)
- Set up React app with Vite
- Integrate PDF.js to render a PDF page-by-page
- Add zoom, scroll, and page navigation controls

### Milestone 2 — Redaction UI (Week 3–4)
- Overlay Fabric.js canvas on top of PDF.js render
- Draw, resize, and delete redaction boxes
- Visual confirmation (black box preview)

### Milestone 3 — Export (Week 5)
- Integrate pdf-lib
- On "Apply Redactions": read original PDF bytes, draw permanent black rectangles at the correct coordinates, remove underlying content, output new PDF
- Download button

### Milestone 4 — Polish & Annotation (Week 6–8)
- Add highlight, sticky notes, text boxes
- Clean up the UI
- Add page management (reorder/delete/rotate)

### Milestone 5 — Document Utilities (Week 9–12)
- Merge and split PDFs
- Compress PDFs
- Form field detection and filling

### Milestone 6 — OCR & Backend (Month 4+)
- Set up local FastAPI server
- Integrate Tesseract via PyMuPDF
- AI-assisted redaction suggestions

---

## Resources & References

### Libraries
- PDF.js — https://mozilla.github.io/pdf.js/
- pdf-lib — https://pdf-lib.js.org/
- Fabric.js — http://fabricjs.com/
- Konva.js (alternative to Fabric) — https://konvajs.org/
- PyMuPDF — https://pymupdf.readthedocs.io/

### Open-Source Inspiration
- Stirling PDF (study the feature set) — https://github.com/Stirling-Tools/stirling-pdf
- PDF.js viewer demo — https://mozilla.github.io/pdf.js/web/viewer.html

### Tooling
- Vite — fast React project scaffolding
- Tailwind CSS — https://tailwindcss.com/

---

## North Star

> Build the PDF tool you wish existed: runs in your browser, touches no server, looks good, and is completely free. Start with redaction — nail that one thing — then expand.
