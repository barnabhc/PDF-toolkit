import { useState } from 'react'
import { Modal } from './Modal'
import { useEditor } from '../context/EditorContext'
import { pickPdfFiles, savePdfBytes } from '../lib/fileAccess'
import { mergeInWorker } from '../lib/pdf/mergeClient'
import { toArrayBuffer } from '../lib/binary'

interface MergeItem {
  id: string
  name: string
  size: number
  source: File | Uint8Array
}

export function MergeModal() {
  const { doc, setMergeModalOpen } = useEditor()
  const [items, setItems] = useState<MergeItem[]>(() =>
    doc && !doc.encrypted
      ? [{ id: 'open-document', name: doc.name, size: doc.bytes.byteLength, source: doc.bytes }]
      : [],
  )
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = progress !== null

  const close = () => !busy && setMergeModalOpen(false)

  const addFiles = async () => {
    const files = await pickPdfFiles(true)
    setItems((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size, source: file })),
    ])
  }

  const move = (index: number, delta: -1 | 1) => {
    setItems((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const remove = (index: number) => setItems((current) => current.filter((_, i) => i !== index))

  const merge = async () => {
    setError(null)
    setProgress({ done: 0, total: items.length })
    try {
      // Copy every source into a transferable buffer (the open document's
      // bytes must survive, so they are copied, not transferred).
      const files = await Promise.all(
        items.map(async (item) => ({
          name: item.name,
          buffer: item.source instanceof Uint8Array ? toArrayBuffer(item.source) : await item.source.arrayBuffer(),
        })),
      )
      const bytes = await mergeInWorker(files, (done, total) => setProgress({ done, total }))
      const saved = await savePdfBytes(bytes, 'merged.pdf')
      if (saved) setMergeModalOpen(false)
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : 'Merge failed.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <Modal title="Merge PDFs" onClose={close}>
      <div className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Add two or more PDFs to combine them into one file.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                <span className="w-5 text-right text-xs text-zinc-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-700" title={item.name}>
                  {item.name}
                  {item.source instanceof Uint8Array && (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 text-xs text-blue-600">open now</span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-zinc-400">{formatBytes(item.size)}</span>
                <span className="flex gap-0.5">
                  <RowButton label="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</RowButton>
                  <RowButton label="Move down" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>↓</RowButton>
                  <RowButton label="Remove" disabled={busy} onClick={() => remove(index)}>✕</RowButton>
                </span>
              </li>
            ))}
          </ol>
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {busy && (
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => void addFiles()}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            Add PDFs…
          </button>
          <button
            type="button"
            onClick={() => void merge()}
            disabled={busy || items.length < 2}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? `Merging ${progress.done}/${progress.total}…` : 'Merge & save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RowButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded px-1.5 py-0.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
