import type { CssRect, PdfRect } from '../types'

/*
 * The single source of truth for mapping between the two coordinate systems
 * this app deals with. Every feature that writes to the PDF goes through here.
 *
 * CSS space   — relative to the rendered page element: origin top-left,
 *               y down, CSS pixels at the current zoom `scale`.
 * PDF space   — user space of the *unrotated* page: origin bottom-left,
 *               y up, PDF points, offset by the page's CropBox.
 *
 * `rotation` is the page's /Rotate value: degrees the page is rotated
 * *clockwise* for display (pdf.js follows the same convention).
 */

export type Rotation = 0 | 90 | 180 | 270

export interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

/** Static facts about a page needed to map between screen and PDF space. */
export interface PageGeometry {
  cropBox: CropBox
  rotation: Rotation
}

export interface Point {
  x: number
  y: number
}

export function normalizeRotation(degrees: number): Rotation {
  const snapped = Math.round(degrees / 90) * 90
  return (((snapped % 360) + 360) % 360) as Rotation
}

/** Builds geometry from pdf.js `page.view` ([xMin, yMin, xMax, yMax]) and `page.rotate`. */
export function geometryFromView(view: readonly number[], rotate: number): PageGeometry {
  const [xMin, yMin, xMax, yMax] = view
  return {
    cropBox: { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin },
    rotation: normalizeRotation(rotate),
  }
}

/** Rendered size of the page in CSS pixels at `scale` (rotation swaps the axes). */
export function cssPageSize(geometry: PageGeometry, scale: number): { width: number; height: number } {
  const { width, height } = geometry.cropBox
  const swapAxes = geometry.rotation % 180 !== 0
  return {
    width: (swapAxes ? height : width) * scale,
    height: (swapAxes ? width : height) * scale,
  }
}

export function cssToPdfPoint(point: Point, geometry: PageGeometry, scale: number): Point {
  const { cropBox, rotation } = geometry
  const x = point.x / scale
  const y = point.y / scale
  let relX: number
  let relY: number
  switch (rotation) {
    case 0:
      relX = x
      relY = cropBox.height - y
      break
    case 90:
      relX = y
      relY = x
      break
    case 180:
      relX = cropBox.width - x
      relY = y
      break
    case 270:
      relX = cropBox.width - y
      relY = cropBox.height - x
      break
  }
  return { x: cropBox.x + relX, y: cropBox.y + relY }
}

export function pdfToCssPoint(point: Point, geometry: PageGeometry, scale: number): Point {
  const { cropBox, rotation } = geometry
  const relX = point.x - cropBox.x
  const relY = point.y - cropBox.y
  let x: number
  let y: number
  switch (rotation) {
    case 0:
      x = relX
      y = cropBox.height - relY
      break
    case 90:
      x = relY
      y = relX
      break
    case 180:
      x = cropBox.width - relX
      y = relY
      break
    case 270:
      x = cropBox.height - relY
      y = cropBox.width - relX
      break
  }
  return { x: x * scale, y: y * scale }
}

export function cssToPdfRect(rect: CssRect, geometry: PageGeometry, scale: number): PdfRect {
  const a = cssToPdfPoint({ x: rect.x, y: rect.y }, geometry, scale)
  const b = cssToPdfPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, geometry, scale)
  return rectFromCorners(a, b)
}

export function pdfToCssRect(rect: PdfRect, geometry: PageGeometry, scale: number): CssRect {
  const a = pdfToCssPoint({ x: rect.x, y: rect.y }, geometry, scale)
  const b = pdfToCssPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, geometry, scale)
  return rectFromCorners(a, b)
}

function rectFromCorners(a: Point, b: Point): { x: number; y: number; width: number; height: number } {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}
