import { describe, expect, it } from 'vitest'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from '@cantoo/pdf-lib'
import { applyHighlights, readHighlightAnnotations } from './highlights'
import type { HighlightAnnotation } from '../../types'

const YELLOW = { r: 1, g: 0.92, b: 0.23 }

async function docWithOnePage(): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  doc.addPage([600, 800])
  return doc
}

function highlight(overrides: Partial<HighlightAnnotation> = {}): HighlightAnnotation {
  return {
    id: 'h1',
    pageIndex: 0,
    quads: [{ x: 100, y: 700, width: 200, height: 20 }],
    color: YELLOW,
    opacity: 0.4,
    ...overrides,
  }
}

describe('applyHighlights', () => {
  it('survives a save/reload round trip as a real /Highlight annotation', async () => {
    const doc = await docWithOnePage()
    applyHighlights(doc, [highlight()])
    const reloaded = await PDFDocument.load(await doc.save())

    const annotations = readHighlightAnnotations(reloaded.getPage(0))
    expect(annotations).toHaveLength(1)

    const annotation = annotations[0]
    const quadPoints = annotation.lookup(PDFName.of('QuadPoints'), PDFArray)
    expect(quadPoints.size()).toBe(8)

    // Spec order: UL, UR, LL, LR — for quad x:100 y:700 w:200 h:20.
    const values = Array.from({ length: 8 }, (_, i) => quadPoints.lookup(i, PDFNumber).asNumber())
    expect(values).toEqual([100, 720, 300, 720, 100, 700, 300, 700])

    const rect = annotation.lookup(PDFName.of('Rect'), PDFArray)
    const rectValues = Array.from({ length: 4 }, (_, i) => rect.lookup(i, PDFNumber).asNumber())
    expect(rectValues).toEqual([100, 700, 300, 720])
  })

  it('writes an appearance stream so viewers are not left to synthesize one', async () => {
    const doc = await docWithOnePage()
    applyHighlights(doc, [highlight()])
    const reloaded = await PDFDocument.load(await doc.save())

    const [annotation] = readHighlightAnnotations(reloaded.getPage(0))
    const appearance = annotation.lookup(PDFName.of('AP'), PDFDict)
    expect(appearance.has(PDFName.of('N'))).toBe(true)
  })

  it('spans multiple quads (multi-line selections) in one annotation', async () => {
    const doc = await docWithOnePage()
    applyHighlights(doc, [
      highlight({
        quads: [
          { x: 100, y: 700, width: 200, height: 20 },
          { x: 100, y: 675, width: 150, height: 20 },
        ],
      }),
    ])
    const reloaded = await PDFDocument.load(await doc.save())

    const [annotation] = readHighlightAnnotations(reloaded.getPage(0))
    expect(annotation.lookup(PDFName.of('QuadPoints'), PDFArray).size()).toBe(16)

    // Rect must cover both quads.
    const rect = annotation.lookup(PDFName.of('Rect'), PDFArray)
    const rectValues = Array.from({ length: 4 }, (_, i) => rect.lookup(i, PDFNumber).asNumber())
    expect(rectValues).toEqual([100, 675, 300, 720])
  })

  it('appends to an existing /Annots array instead of clobbering it', async () => {
    const doc = await docWithOnePage()
    applyHighlights(doc, [highlight()])
    applyHighlights(doc, [highlight({ id: 'h2', quads: [{ x: 50, y: 100, width: 80, height: 12 }] })])
    const reloaded = await PDFDocument.load(await doc.save())
    expect(readHighlightAnnotations(reloaded.getPage(0))).toHaveLength(2)
  })
})
