import { PDFArray, PDFDict, PDFName, type PDFContext, type PDFDocument, type PDFPage, type PDFRef } from '@cantoo/pdf-lib'
import type { HighlightAnnotation, PdfRect, RGB } from '../../types'

/*
 * Writes highlights as real /Highlight annotations (not flattened rectangles),
 * so they stay standard, removable, and visible in other viewers.
 *
 * pdf-lib has no high-level API for this, so the dictionaries are built by
 * hand. Each annotation carries an appearance stream (/AP) — viewers are not
 * required to synthesize one from /QuadPoints, so without it some (including
 * Acrobat) may show nothing.
 */

export function applyHighlights(doc: PDFDocument, highlights: HighlightAnnotation[]): void {
  for (const highlight of highlights) {
    addHighlightAnnotation(doc, highlight)
  }
}

function addHighlightAnnotation(doc: PDFDocument, highlight: HighlightAnnotation): void {
  const { pageIndex, quads, color, opacity } = highlight
  if (quads.length === 0) return
  const page = doc.getPage(pageIndex)
  const context = doc.context
  const rect = boundingBox(quads)

  // Spec order per quad: upper-left, upper-right, lower-left, lower-right.
  const quadPoints = quads.flatMap((q) => [
    q.x, q.y + q.height,
    q.x + q.width, q.y + q.height,
    q.x, q.y,
    q.x + q.width, q.y,
  ])

  const annotation = context.obj({
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    QuadPoints: quadPoints,
    C: [color.r, color.g, color.b],
    CA: opacity,
    F: 4, // print flag
    AP: context.obj({ N: buildAppearanceStream(context, rect, quads, color, opacity) }),
  })

  appendPageAnnotation(page, context.register(annotation))
}

/**
 * Form XObject that paints each quad in the highlight color with Multiply
 * blending, mimicking how ink sits on top of text. BBox equals /Rect with an
 * identity matrix, so stream coordinates are plain page coordinates.
 */
function buildAppearanceStream(
  context: PDFContext,
  rect: PdfRect,
  quads: PdfRect[],
  color: RGB,
  opacity: number,
): PDFRef {
  const operations = [
    '/G0 gs',
    `${fmt(color.r)} ${fmt(color.g)} ${fmt(color.b)} rg`,
    ...quads.map((q) => `${fmt(q.x)} ${fmt(q.y)} ${fmt(q.width)} ${fmt(q.height)} re f`),
  ].join('\n')

  const stream = context.stream(operations, {
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Resources: {
      ExtGState: { G0: { Type: 'ExtGState', BM: 'Multiply', CA: opacity, ca: opacity } },
    },
  })
  return context.register(stream)
}

function appendPageAnnotation(page: PDFPage, annotationRef: PDFRef): void {
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
  if (existing) {
    existing.push(annotationRef)
  } else {
    page.node.set(PDFName.of('Annots'), page.doc.context.obj([annotationRef]))
  }
}

function boundingBox(quads: PdfRect[]): PdfRect {
  const xMin = Math.min(...quads.map((q) => q.x))
  const yMin = Math.min(...quads.map((q) => q.y))
  const xMax = Math.max(...quads.map((q) => q.x + q.width))
  const yMax = Math.max(...quads.map((q) => q.y + q.height))
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin }
}

function fmt(value: number): number {
  return Math.round(value * 100) / 100
}

/** Test hook: reads back the /Highlight annotations on a page. */
export function readHighlightAnnotations(page: PDFPage): PDFDict[] {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
  if (!annots) return []
  const dicts: PDFDict[] = []
  for (let i = 0; i < annots.size(); i++) {
    const dict = annots.lookup(i, PDFDict)
    if (dict.lookupMaybe(PDFName.of('Subtype'), PDFName) === PDFName.of('Highlight')) {
      dicts.push(dict)
    }
  }
  return dicts
}
