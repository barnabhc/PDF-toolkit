import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { mergePdfs } from './merge'

async function pdfWithPages(count: number, size: [number, number]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < count; i++) doc.addPage(size)
  return doc.save()
}

describe('mergePdfs', () => {
  it('concatenates pages in input order', async () => {
    const first = await pdfWithPages(2, [100, 100])
    const second = await pdfWithPages(3, [200, 200])

    const merged = await PDFDocument.load(await mergePdfs([
      { name: 'first.pdf', bytes: first },
      { name: 'second.pdf', bytes: second },
    ]))

    expect(merged.getPageCount()).toBe(5)
    // Distinct page sizes prove the ordering.
    expect(merged.getPage(0).getWidth()).toBe(100)
    expect(merged.getPage(1).getWidth()).toBe(100)
    expect(merged.getPage(2).getWidth()).toBe(200)
    expect(merged.getPage(4).getWidth()).toBe(200)
  })

  it('reports progress per file', async () => {
    const first = await pdfWithPages(1, [100, 100])
    const second = await pdfWithPages(1, [100, 100])
    const progress: Array<[number, number]> = []

    await mergePdfs(
      [
        { name: 'a.pdf', bytes: first },
        { name: 'b.pdf', bytes: second },
      ],
      (done, total) => progress.push([done, total]),
    )

    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('rejects fewer than two inputs', async () => {
    const only = await pdfWithPages(1, [100, 100])
    await expect(mergePdfs([{ name: 'only.pdf', bytes: only }])).rejects.toThrow(/at least two/)
  })

  it('names the offending file when input is not a valid PDF', async () => {
    const good = await pdfWithPages(1, [100, 100])
    const garbage = new TextEncoder().encode('not a pdf at all')

    await expect(
      mergePdfs([
        { name: 'good.pdf', bytes: good },
        { name: 'garbage.pdf', bytes: garbage },
      ]),
    ).rejects.toThrow(/garbage\.pdf/)
  })
})
