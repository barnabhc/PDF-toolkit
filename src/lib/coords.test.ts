import { describe, expect, it } from 'vitest'
import {
  cssPageSize,
  cssToPdfPoint,
  cssToPdfRect,
  geometryFromView,
  normalizeRotation,
  pdfToCssPoint,
  pdfToCssRect,
  type PageGeometry,
  type Rotation,
} from './coords'

const geometry = (rotation: Rotation, cropBox = { x: 0, y: 0, width: 600, height: 800 }): PageGeometry => ({
  cropBox,
  rotation,
})

describe('normalizeRotation', () => {
  it('snaps and wraps arbitrary degree values', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-270)).toBe(90)
  })
})

describe('geometryFromView', () => {
  it('reads the crop box and rotation from pdf.js page facts', () => {
    const g = geometryFromView([50, 25, 550, 725], 90)
    expect(g.cropBox).toEqual({ x: 50, y: 25, width: 500, height: 700 })
    expect(g.rotation).toBe(90)
  })
})

describe('cssPageSize', () => {
  it('swaps axes for 90/270 and scales', () => {
    expect(cssPageSize(geometry(0), 2)).toEqual({ width: 1200, height: 1600 })
    expect(cssPageSize(geometry(90), 2)).toEqual({ width: 1600, height: 1200 })
    expect(cssPageSize(geometry(180), 0.5)).toEqual({ width: 300, height: 400 })
    expect(cssPageSize(geometry(270), 1)).toEqual({ width: 800, height: 600 })
  })
})

describe('pdfToCssPoint corner mapping', () => {
  // PDF user-space corners of a 600×800 page and where each lands on screen.
  // /Rotate is clockwise on display: at 90° the unrotated bottom-left corner
  // becomes the top-left of what the reader sees.
  const bottomLeft = { x: 0, y: 0 }
  const topRight = { x: 600, y: 800 }

  const cases: Array<[Rotation, { x: number; y: number }, { x: number; y: number }]> = [
    [0, bottomLeft, { x: 0, y: 1600 }],
    [0, topRight, { x: 1200, y: 0 }],
    [90, bottomLeft, { x: 0, y: 0 }],
    [90, topRight, { x: 1600, y: 1200 }],
    [180, bottomLeft, { x: 1200, y: 0 }],
    [180, topRight, { x: 0, y: 1600 }],
    [270, bottomLeft, { x: 1600, y: 1200 }],
    [270, topRight, { x: 0, y: 0 }],
  ]

  it.each(cases)('rotation %d maps %o to %o at scale 2', (rotation, pdfPoint, cssPoint) => {
    expect(pdfToCssPoint(pdfPoint, geometry(rotation), 2)).toEqual(cssPoint)
  })
})

describe('crop box offsets', () => {
  const offsetGeometry = geometry(0, { x: 50, y: 25, width: 500, height: 700 })

  it('maps the crop box origin to the bottom-left of the rendered page', () => {
    expect(pdfToCssPoint({ x: 50, y: 25 }, offsetGeometry, 1)).toEqual({ x: 0, y: 700 })
    expect(cssToPdfPoint({ x: 0, y: 0 }, offsetGeometry, 1)).toEqual({ x: 50, y: 725 })
  })
})

describe('round trips', () => {
  const rotations: Rotation[] = [0, 90, 180, 270]
  const cropBoxes = [
    { x: 0, y: 0, width: 600, height: 800 },
    { x: 30, y: 60, width: 480, height: 640 },
  ]
  const samplePoints = [
    { x: 10, y: 20 },
    { x: 300, y: 400 },
    { x: 599, y: 1 },
  ]

  it('css → pdf → css is the identity (within float tolerance)', () => {
    for (const rotation of rotations) {
      for (const cropBox of cropBoxes) {
        const g = geometry(rotation, cropBox)
        for (const point of samplePoints) {
          const there = cssToPdfPoint(point, g, 1.5)
          const back = pdfToCssPoint(there, g, 1.5)
          expect(back.x).toBeCloseTo(point.x, 6)
          expect(back.y).toBeCloseTo(point.y, 6)
        }
      }
    }
  })
})

describe('rect conversion', () => {
  it('produces a normalized pdf rect from a css rect on a rotated page', () => {
    // 600×800 page at /Rotate 90, scale 1. CSS rect corners (100,50)-(300,130)
    // map to pdf (50,100) and (130,300) → normalized lower-left (50,100), 80×200.
    const rect = cssToPdfRect({ x: 100, y: 50, width: 200, height: 80 }, geometry(90), 1)
    expect(rect).toEqual({ x: 50, y: 100, width: 80, height: 200 })
  })

  it('round-trips rects', () => {
    const g = geometry(270, { x: 12, y: 34, width: 500, height: 700 })
    const original = { x: 40, y: 80, width: 120, height: 60 }
    const back = pdfToCssRect(cssToPdfRect(original, g, 2), g, 2)
    expect(back.x).toBeCloseTo(original.x, 6)
    expect(back.y).toBeCloseTo(original.y, 6)
    expect(back.width).toBeCloseTo(original.width, 6)
    expect(back.height).toBeCloseTo(original.height, 6)
  })
})
