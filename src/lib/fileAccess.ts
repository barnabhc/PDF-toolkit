/**
 * File open/save. Uses the File System Access API where available (Chromium),
 * falling back to <input type=file> and anchor downloads elsewhere.
 * Saving always goes through an explicit picker/download — never a silent overwrite.
 */

const PDF_PICKER_TYPES = [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }]

export async function pickPdfFiles(multiple = false): Promise<File[]> {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({ types: PDF_PICKER_TYPES, multiple })
      return await Promise.all(handles.map((handle) => handle.getFile()))
    } catch (error) {
      if (isUserCancel(error)) return []
      throw error
    }
  }
  return pickViaInput(multiple)
}

function pickViaInput(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
}

/** Returns false if the user cancelled the save dialog. */
export async function savePdfBytes(bytes: Uint8Array, suggestedName: string): Promise<boolean> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: PDF_PICKER_TYPES })
      const writable = await handle.createWritable()
      await writable.write(bytes as unknown as BufferSource)
      await writable.close()
      return true
    } catch (error) {
      if (isUserCancel(error)) return false
      throw error
    }
  }
  downloadBytes(bytes, suggestedName)
  return true
}

export function downloadBytes(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function isUserCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
