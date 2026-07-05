import { useRef, useState, type DragEvent } from 'react'
import { EditorProvider, useEditor } from './context/EditorContext'
import { Toolbar } from './components/Toolbar'
import { EmptyState } from './components/EmptyState'
import { Viewer } from './components/Viewer'
import { ThumbnailSidebar } from './components/ThumbnailSidebar'
import { SignatureModal } from './components/SignatureModal'
import { MergeModal } from './components/MergeModal'
import { BusyIndicator, ErrorBanner, PendingSignatureHint } from './components/StatusOverlays'

export default function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}

function Shell() {
  const { doc, openDocumentFiles, signatureModalOpen, mergeModalOpen } = useEditor()
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current += 1
    if (event.dataTransfer.types.includes('Files')) setDropActive(true)
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropActive(false)
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setDropActive(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) void openDocumentFiles(files)
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-900"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Toolbar />
      {doc ? (
        <div className="flex min-h-0 flex-1">
          <ThumbnailSidebar />
          <Viewer />
        </div>
      ) : (
        <EmptyState />
      )}

      {signatureModalOpen && <SignatureModal />}
      {mergeModalOpen && <MergeModal />}
      <ErrorBanner />
      <BusyIndicator />
      <PendingSignatureHint />

      {dropActive && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center rounded-lg border-4 border-dashed border-blue-400 bg-blue-50/60">
          <span className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-lg">
            Drop to open PDF
          </span>
        </div>
      )}
    </div>
  )
}
