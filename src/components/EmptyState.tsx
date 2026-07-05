import { useEditor } from '../context/EditorContext'

export function EmptyState() {
  const { openDocumentPicker, setMergeModalOpen } = useEditor()

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 p-8">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 px-10 py-16 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-800">PDF Toolkit</h1>
          <p className="mt-2 text-sm text-zinc-500">
            View, highlight, sign, and merge PDFs — entirely in your browser.
            <br />
            Nothing is ever uploaded; files never leave this device.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void openDocumentPicker()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-500"
          >
            Open a PDF
          </button>
          <button
            type="button"
            onClick={() => setMergeModalOpen(true)}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Merge PDFs
          </button>
        </div>
        <p className="text-xs text-zinc-400">…or drag &amp; drop a PDF anywhere in this window</p>
      </div>
    </main>
  )
}
