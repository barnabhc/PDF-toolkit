import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { writeAnnotatedPdf } from './saveDocument'
import type { HighlightAnnotation, SignatureAnnotation } from '../../types'

/*
 * The strongest correctness check we can run headlessly: annotations written
 * through pdf-lib must be readable by pdf.js — a completely independent
 * parser — and the original text must still be extractable afterwards.
 */

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function makeSourcePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([600, 800])
  page.setFont(font)
  page.drawText('The quick brown fox', { x: 72, y: 700, size: 18 })
  return doc.save()
}

const highlight: HighlightAnnotation = {
  id: 'h1',
  pageIndex: 0,
  quads: [{ x: 70, y: 695, width: 180, height: 24 }],
  color: { r: 1, g: 0.85, b: 0.2 },
  opacity: 0.4,
}

const signature: SignatureAnnotation = {
  id: 's1',
  pageIndex: 0,
  rect: { x: 100, y: 100, width: 150, height: 60 },
  image: { dataUrl: TINY_PNG, width: 1, height: 1 },
}

describe('saved PDFs round-trip through pdf.js', () => {
  it('pdf.js sees the highlight annotation and can still extract the text', async () => {
    const saved = await writeAnnotatedPdf(await makeSourcePdf(), [highlight], [signature])

    const pdf = await pdfjs.getDocument({ data: saved.slice(), isEvalSupported: false }).promise
    const page = await pdf.getPage(1)

    const annotations = await page.getAnnotations()
    const highlights = annotations.filter((a) => a.subtype === 'Highlight')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].quadPoints).toBeTruthy()

    // Highlighting must never damage the text underneath.
    const textContent = await page.getTextContent()
    const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    expect(text).toContain('The quick brown fox')

    await pdf.destroy()
  })
})
