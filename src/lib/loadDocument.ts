import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfjs } from './pdfjs'
import { cssPageSize, geometryFromView, type PageGeometry } from './coords'

export interface PageInfo {
  geometry: PageGeometry
  /** Rendered CSS size at scale 1 (rotation already applied). */
  baseWidth: number
  baseHeight: number
}

export interface LoadedDocument {
  pdf: PDFDocumentProxy
  /** Untouched copy of the original file, the input for every later edit. */
  bytes: Uint8Array
  name: string
  /** Password-protected documents are view-only in the MVP. */
  encrypted: boolean
  pages: PageInfo[]
}

/** Resolves to the password, or null if the user cancelled. */
export type PasswordPrompt = (isRetry: boolean) => string | null

export async function loadDocument(
  data: ArrayBuffer,
  name: string,
  promptPassword: PasswordPrompt,
): Promise<LoadedDocument> {
  // pdf.js transfers `data` to its worker; copy first so edits/saves keep working.
  const bytes = new Uint8Array(data.slice(0))

  let encrypted = false
  const task = pdfjs.getDocument({ data })
  task.onPassword = (setPassword: (password: string) => void, reason: number) => {
    encrypted = true
    const password = promptPassword(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD)
    if (password === null) void task.destroy()
    else setPassword(password)
  }

  const pdf = await task.promise
  const pages: PageInfo[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const geometry = geometryFromView(page.view, page.rotate)
    const { width, height } = cssPageSize(geometry, 1)
    pages.push({ geometry, baseWidth: width, baseHeight: height })
  }

  return { pdf, bytes, name, encrypted, pages }
}

export function describeLoadError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'PasswordException') return 'This PDF is password-protected — a password is required to view it.'
    if (error.name === 'InvalidPDFException') return 'This file is not a valid PDF (it may be corrupt or truncated).'
  }
  return 'Could not open this PDF.'
}
