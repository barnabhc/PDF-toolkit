import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../context/EditorContext'

const THUMB_WIDTH = 116

export function ThumbnailSidebar() {
  const { doc, currentPage, scrollToPage } = useEditor()
  if (!doc) return null

  return (
    <aside className="w-44 shrink-0 overflow-y-auto border-r border-zinc-300 bg-zinc-50 px-4 py-4" aria-label="Page thumbnails">
      <div className="flex flex-col items-center gap-4">
        {doc.pages.map((_, index) => (
          <Thumbnail key={index} index={index} active={currentPage === index + 1} onSelect={() => scrollToPage(index + 1)} />
        ))}
      </div>
    </aside>
  )
}

function Thumbnail({ index, active, onSelect }: { index: number; active: boolean; onSelect: () => void }) {
  const { doc } = useEditor()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [visible, setVisible] = useState(false)

  const info = doc!.pages[index]
  const height = Math.round(THUMB_WIDTH * (info.baseHeight / info.baseWidth))

  useEffect(() => {
    const el = buttonRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '600px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Same render/release pattern as full pages, at thumbnail resolution.
  useEffect(() => {
    if (!visible || !doc) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null

    ;(async () => {
      const page = await doc.pdf.getPage(index + 1)
      if (cancelled) return
      const viewport = page.getViewport({ scale: (THUMB_WIDTH / info.baseWidth) * 2 })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) return
      renderTask = page.render({ canvasContext: context, viewport })
      await renderTask.promise
    })().catch((error: unknown) => {
      if ((error as Error | null)?.name !== 'RenderingCancelledException') {
        console.error(`Failed to render thumbnail ${index + 1}`, error)
      }
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
      canvas.width = 0
      canvas.height = 0
    }
  }, [visible, doc, index, info.baseWidth])

  return (
    <button
      ref={buttonRef}
      onClick={onSelect}
      className="group flex flex-col items-center gap-1 focus:outline-none"
      aria-label={`Go to page ${index + 1}`}
      aria-current={active ? 'page' : undefined}
    >
      <canvas
        ref={canvasRef}
        style={{ width: THUMB_WIDTH, height }}
        className={`bg-white shadow-sm ring-offset-2 transition-shadow ${
          active ? 'ring-2 ring-blue-500' : 'ring-1 ring-zinc-300 group-hover:ring-blue-300 group-focus-visible:ring-blue-400'
        }`}
      />
      <span className={`text-xs ${active ? 'font-semibold text-blue-600' : 'text-zinc-500'}`}>{index + 1}</span>
    </button>
  )
}
