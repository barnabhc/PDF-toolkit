import type { SignatureImage } from '../types'

/**
 * Saved signatures live in localStorage — on the user's machine only, in line
 * with the "nothing leaves this device" promise.
 */
const STORAGE_KEY = 'pdf-toolkit.signatures.v1'
const MAX_SAVED = 6

export function loadSavedSignatures(): SignatureImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSignatureImage)
  } catch {
    return []
  }
}

export function rememberSignature(signature: SignatureImage): SignatureImage[] {
  const existing = loadSavedSignatures().filter((s) => s.dataUrl !== signature.dataUrl)
  const updated = [signature, ...existing].slice(0, MAX_SAVED)
  persist(updated)
  return updated
}

export function forgetSignature(dataUrl: string): SignatureImage[] {
  const updated = loadSavedSignatures().filter((s) => s.dataUrl !== dataUrl)
  persist(updated)
  return updated
}

function persist(signatures: SignatureImage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signatures))
  } catch {
    // Quota exceeded — saved signatures are a convenience, not critical state.
  }
}

function isSignatureImage(value: unknown): value is SignatureImage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.dataUrl === 'string' &&
    candidate.dataUrl.startsWith('data:image/') &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  )
}
