import { EncryptedPDFError, PDFDocument } from '@cantoo/pdf-lib'

export interface MergeInput {
  name: string
  bytes: Uint8Array
}

export type MergeProgress = (filesDone: number, filesTotal: number) => void

/** Concatenates the given PDFs, in order, into a new document. */
export async function mergePdfs(inputs: MergeInput[], onProgress?: MergeProgress): Promise<Uint8Array> {
  if (inputs.length < 2) throw new Error('Select at least two PDFs to merge.')
  const output = await PDFDocument.create()
  for (const [index, input] of inputs.entries()) {
    const source = await loadSource(input)
    const pages = await output.copyPages(source, source.getPageIndices())
    for (const page of pages) output.addPage(page)
    onProgress?.(index + 1, inputs.length)
  }
  return output.save()
}

async function loadSource(input: MergeInput): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(input.bytes)
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new Error(`"${input.name}" is password-protected and can't be merged.`)
    }
    throw new Error(`Could not read "${input.name}" — it may be corrupt or not a PDF.`)
  }
}
