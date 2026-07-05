import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { pdfjs } from '../lib/pdfjs'
import { useEditor } from '../context/EditorContext'
import { cssPageSize, cssToPdfRect } from '../lib/coords'
import { clamp } from '../constants'
import { HighlightsOverlay } from './HighlightsOverlay'
import { SignaturesOverlay } from './SignaturesOverlay'

/** How far off-screen a page can be and still stay rendered. */
const RENDER_MARGIN = '1200px 0px'

export function PageView({ index, registerRef }: { index: number; registerRef: (index: number, el: HTMLDivElement | null) => void }) {
  const { doc, scale, viewerRef, pendingSignature, setPendingSignature, dispatchAnnotations, setSelection } = useEditor()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  const info = doc!.pages[index]
  const { width, height } = cssPageSize(info.geometry, scale)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: viewerRef.current, rootMargin: RENDER_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [viewerRef])

  // Render the page bitmap + text layer while near the viewport; release both when far.
  useEffect(() => {
    if (!visible || !doc) return
    const canvas = canvasRef.current
    const textContainer = textLayerRef.current
    if (!canvas || !textContainer) return

    let cancelled = false
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | null = null

    ;(async () => {
      const page = await doc.pdf.getPage(index + 1)
      if (cancelled) return
      const viewport = page.getViewport({ scale })

      const outputScale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) return

      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      })
      await renderTask.promise
      if (cancelled) return
      setRendered(true)

      textContainer.style.setProperty('--scale-factor', String(viewport.scale))
      textLayer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textContainer,
        viewport,
      })
      await textLayer.render()
    })().catch((error: unknown) => {
      if ((error as Error | null)?.name !== 'RenderingCancelledException') {
        console.error(`Failed to render page ${index + 1}`, error)
      }
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
      // Free the bitmap and text nodes — this is what keeps huge PDFs viable.
      canvas.width = 0
      canvas.height = 0
      textContainer.replaceChildren()
      setRendered(false)
    }
  }, [visible, scale, doc, index])

  const placeSignature = (event: MouseEvent<HTMLDivElement>) => {
    if (!pendingSignature || !wrapperRef.current) return
    event.preventDefault()
    event.stopPropagation()

    const bounds = wrapperRef.current.getBoundingClientRect()
    const cssWidth = Math.min(pendingSignature.width, width * 0.4)
    const cssHeight = cssWidth * (pendingSignature.height / pendingSignature.width)
    const cssRect = {
      x: clamp(event.clientX - bounds.left - cssWidth / 2, 0, Math.max(0, width - cssWidth)),
      y: clamp(event.clientY - bounds.top - cssHeight / 2, 0, Math.max(0, height - cssHeight)),
      width: cssWidth,
      height: cssHeight,
    }

    const id = crypto.randomUUID()
    dispatchAnnotations({
      type: 'add-signature',
      signature: { id, pageIndex: index, rect: cssToPdfRect(cssRect, info.geometry, scale), image: pendingSignature },
    })
    setPendingSignature(null)
    setSelection({ kind: 'signature', id })
  }

  return (
    <div
      ref={(el) => {
        wrapperRef.current = el
        registerRef(index, el)
      }}
      data-page-index={index}
      className="relative shrink-0 bg-white shadow-md"
      style={{ width, height, cursor: pendingSignature ? 'crosshair' : undefined }}
      onClickCapture={pendingSignature ? placeSignature : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={`Page ${index + 1}`} />
      <div ref={textLayerRef} className="textLayer" />
      <HighlightsOverlay pageIndex={index} />
      <SignaturesOverlay pageIndex={index} />
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-4xl font-light text-zinc-200">
          {index + 1}
        </div>
      )}
    </div>
  )
}
