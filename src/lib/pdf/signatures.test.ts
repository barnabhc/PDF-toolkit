import { describe, expect, it } from 'vitest'
import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib'
import { applySignatures, placementFor } from './signatures'
import type { Rotation } from '../coords'
import type { PdfRect } from '../../types'

// 1×1 transparent PNG.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('placementFor', () => {
  const rect: PdfRect = { x: 40, y: 60, width: 120, height: 50 }
  const rotations: Rotation[] = [0, 90, 180, 270]

  /**
   * Replicates pdf-lib's draw transform: rotate the placed image's corners
   * around its (x, y) anchor by `rotate` (counter-clockwise, standard math)
   * and return the covered bounding box.
   */
  function coveredBox(placement: ReturnType<typeof placementFor>) {
    const angle = ((placement.rotate?.angle ?? 0) * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const corners = [
      [0, 0],
      [placement.width, 0],
      [0, placement.height],
      [placement.width, placement.height],
    ].map(([lx, ly]) => ({
      x: placement.x + lx * cos - ly * sin,
      y: placement.y + lx * sin + ly * cos,
    }))
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }

  it.each(rotations)('at page rotation %d the drawn image covers exactly the target rect', (rotation) => {
    const box = coveredBox(placementFor(rect, rotation))
    expect(box.x).toBeCloseTo(rect.x, 6)
    expect(box.y).toBeCloseTo(rect.y, 6)
    expect(box.width).toBeCloseTo(rect.width, 6)
    expect(box.height).toBeCloseTo(rect.height, 6)
  })

  it('counter-rotates against the page rotation', () => {
    expect(placementFor(rect, 0).rotate).toBeUndefined()
    expect(placementFor(rect, 90).rotate?.angle).toBe(90)
    expect(placementFor(rect, 180).rotate?.angle).toBe(180)
    expect(placementFor(rect, 270).rotate?.angle).toBe(-90)
  })
})

describe('applySignatures', () => {
  it('embeds the image into the page resources after save/reload', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800])
    await applySignatures(doc, [
      {
        id: 's1',
        pageIndex: 0,
        rect: { x: 100, y: 100, width: 150, height: 60 },
        image: { dataUrl: TINY_PNG, width: 1, height: 1 },
      },
    ])
    const reloaded = await PDFDocument.load(await doc.save())

    const resources = reloaded.getPage(0).node.lookup(PDFName.of('Resources'), PDFDict)
    const xObjects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict)
    expect(xObjects).toBeDefined()
    expect(xObjects!.keys().length).toBeGreaterThan(0)
  })
})
