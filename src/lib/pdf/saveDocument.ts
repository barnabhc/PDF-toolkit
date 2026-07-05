import { PDFDocument } from '@cantoo/pdf-lib'
import { applyHighlights } from './highlights'
import { applySignatures } from './signatures'
import type { HighlightAnnotation, SignatureAnnotation } from '../../types'

/**
 * Produces a new PDF with all pending annotations written in. Always a full
 * rewrite (pdf-lib's default), never an incremental update, so no stale
 * prior-revision data survives in the output.
 */
export async function writeAnnotatedPdf(
  originalBytes: Uint8Array,
  highlights: HighlightAnnotation[],
  signatures: SignatureAnnotation[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes)
  applyHighlights(doc, highlights)
  await applySignatures(doc, signatures)
  return doc.save()
}
