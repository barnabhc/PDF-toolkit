import { degrees, type PDFDocument, type PDFImage } from '@cantoo/pdf-lib'
import { normalizeRotation, type Rotation } from '../coords'
import { dataUrlToBytes } from '../binary'
import type { PdfRect, SignatureAnnotation } from '../../types'

/**
 * Flattens visual signatures into page content. This is a plain image draw —
 * deliberately not a cryptographic digital signature.
 */
export async function applySignatures(doc: PDFDocument, signatures: SignatureAnnotation[]): Promise<void> {
  const imageCache = new Map<string, PDFImage>()
  for (const signature of signatures) {
    const image = await embedImage(doc, signature.image.dataUrl, imageCache)
    const page = doc.getPage(signature.pageIndex)
    const rotation = normalizeRotation(page.getRotation().angle)
    page.drawImage(image, placementFor(signature.rect, rotation))
  }
}

interface ImagePlacement {
  x: number
  y: number
  width: number
  height: number
  rotate?: ReturnType<typeof degrees>
}

/**
 * pdf-lib draws in unrotated user space, while `rect` describes where the
 * signature should sit on the *displayed* (rotated) page. Counter-rotate the
 * image and re-anchor it so it reads upright and fills `rect`.
 *
 * Derivation: /Rotate is clockwise on display, pdf-lib's `rotate` is
 * counter-clockwise in user space and pivots on (x, y). For each rotation the
 * anchor is the corner of `rect` that the pivoted image grows out of.
 */
export function placementFor(rect: PdfRect, rotation: Rotation): ImagePlacement {
  switch (rotation) {
    case 0:
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    case 90:
      return { x: rect.x + rect.width, y: rect.y, width: rect.height, height: rect.width, rotate: degrees(90) }
    case 180:
      return { x: rect.x + rect.width, y: rect.y + rect.height, width: rect.width, height: rect.height, rotate: degrees(180) }
    case 270:
      return { x: rect.x, y: rect.y + rect.height, width: rect.height, height: rect.width, rotate: degrees(-90) }
  }
}

async function embedImage(doc: PDFDocument, dataUrl: string, cache: Map<string, PDFImage>): Promise<PDFImage> {
  const cached = cache.get(dataUrl)
  if (cached) return cached
  const bytes = dataUrlToBytes(dataUrl)
  const image = dataUrl.startsWith('data:image/png')
    ? await doc.embedPng(bytes)
    : await doc.embedJpg(bytes)
  cache.set(dataUrl, image)
  return image
}
