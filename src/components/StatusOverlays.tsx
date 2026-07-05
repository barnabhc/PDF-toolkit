import { useEditor } from '../context/EditorContext'

export function ErrorBanner() {
  const { error, dismissError } = useEditor()
  if (!error) return null
  return (
    <div
      role="alert"
      className="fixed left-1/2 top-14 z-50 flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
    >
      <span>{error}</span>
      <button type="button" aria-label="Dismiss" onClick={dismissError} className="font-bold text-red-400 hover:text-red-700">
        ✕
      </button>
    </div>
  )
}

export function BusyIndicator() {
  const { busy } = useEditor()
  if (!busy) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm text-white shadow-lg">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
      {busy}
    </div>
  )
}

export function PendingSignatureHint() {
  const { pendingSignature, setPendingSignature } = useEditor()
  if (!pendingSignature) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
      Click a page to place your signature
      <button
        type="button"
        onClick={() => setPendingSignature(null)}
        className="rounded-full bg-blue-500 px-2 py-0.5 text-xs hover:bg-blue-400"
      >
        Cancel (Esc)
      </button>
    </div>
  )
}
