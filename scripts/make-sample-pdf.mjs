// Generates samples/sample.pdf: three US-letter pages of real (extractable)
// text, with page 2 rotated 90° — the coordinate-mapping stress case.
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)

function addPage(rotation, label) {
  const page = doc.addPage([612, 792])
  page.setFont(font)
  page.drawText(label, { x: 72, y: 700, size: 24 })
  page.drawText('The quick brown fox jumps over the lazy dog.', { x: 72, y: 650, size: 14 })
  page.drawText('Highlight me, sign me, merge me — locally.', { x: 72, y: 620, size: 14 })
  if (rotation) page.setRotation(degrees(rotation))
}

addPage(0, 'Page one (normal)')
addPage(90, 'Page two (rotated 90)')
addPage(0, 'Page three (normal)')

mkdirSync(join(root, 'samples'), { recursive: true })
writeFileSync(join(root, 'samples', 'sample.pdf'), await doc.save())
console.log('Wrote samples/sample.pdf')
