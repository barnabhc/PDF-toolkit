import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditor } from '../context/EditorContext'
import { cssPageSize, cssToPdfRect, pdfToCssRect } from '../lib/coords'
import { clamp } from '../constants'
import type { CssRect, SignatureAnnotation } from '../types'

export function SignaturesOverlay({ pageIndex }: { pageIndex: number }) {
  const { annotations } = useEditor()
  const signatures = annotations.present.signatures.filter((s) => s.pageIndex === pageIndex)
  if (signatures.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0">
      {signatures.map((signature) => (
        <SignatureItem key={signature.id} signature={signature} />
      ))}
    </div>
  )
}

const MIN_CSS_WIDTH = 32

function SignatureItem({ signature }: { signature: SignatureAnnotation }) {
  const { doc, scale, selection, setSelection, dispatchAnnotations } = useEditor()
  const geometry = doc!.pages[signature.pageIndex].geometry
  const page = cssPageSize(geometry, scale)
  const committedCss = pdfToCssRect(signature.rect, geometry, scale)

  // Live rect during a drag/resize; committed to the reducer on pointer-up
  // so each gesture is exactly one undo step.
  const [draftCss, setDraftCss] = useState<CssRect | null>(null)
  const css = draftCss ?? committedCss

  const selected = selection?.kind === 'signature' && selection.id === signature.id
  const aspect = signature.image.height / signature.image.width

  const commit = (finalCss: CssRect) => {
    setDraftCss(null)
    const rect = cssToPdfRect(finalCss, geometry, scale)
    const moved =
      Math.abs(rect.x - signature.rect.x) > 0.01 ||
      Math.abs(rect.y - signature.rect.y) > 0.01 ||
      Math.abs(rect.width - signature.rect.width) > 0.01 ||
      Math.abs(rect.height - signature.rect.height) > 0.01
    if (moved) dispatchAnnotations({ type: 'move-signature', id: signature.id, rect })
  }

  const trackGesture = (
    event: ReactPointerEvent,
    update: (deltaX: number, deltaY: number) => CssRect,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setSelection({ kind: 'signature', id: signature.id })

    const target = event.currentTarget as HTMLElement
    const startX = event.clientX
    const startY = event.clientY
    let latest = committedCss

    const onMove = (move: globalThis.PointerEvent) => {
      latest = update(move.clientX - startX, move.clientY - startY)
      setDraftCss(latest)
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      commit(latest)
    }
    target.setPointerCapture(event.pointerId)
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp, { once: true })
  }

  const startDrag = (event: ReactPointerEvent) =>
    trackGesture(event, (dx, dy) => ({
      ...committedCss,
      x: clamp(committedCss.x + dx, 0, Math.max(0, page.width - committedCss.width)),
      y: clamp(committedCss.y + dy, 0, Math.max(0, page.height - committedCss.height)),
    }))

  const startResize = (event: ReactPointerEvent) =>
    trackGesture(event, (dx) => {
      const maxWidth = Math.min(page.width - committedCss.x, (page.height - committedCss.y) / aspect)
      const width = clamp(committedCss.width + dx, MIN_CSS_WIDTH, Math.max(MIN_CSS_WIDTH, maxWidth))
      return { ...committedCss, width, height: width * aspect }
    })

  return (
    <div
      className="pointer-events-auto absolute touch-none"
      style={{
        left: css.x,
        top: css.y,
        width: css.width,
        height: css.height,
        cursor: 'move',
        outline: selected ? '2px solid rgb(59 130 246)' : '1px dashed rgba(113, 113, 122, 0.6)',
      }}
      onPointerDown={startDrag}
      onClick={(event) => event.stopPropagation()}
    >
      <img src={signature.image.dataUrl} alt="Signature" draggable={false} className="h-full w-full select-none" />
      {selected && (
        <>
          <button
            aria-label="Remove signature"
            className="absolute -right-3 -top-3 grid h-6 w-6 place-items-center rounded-full bg-zinc-800 text-xs text-white shadow hover:bg-red-600"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              dispatchAnnotations({ type: 'remove-signature', id: signature.id })
              setSelection(null)
            }}
          >
            ✕
          </button>
          <div
            aria-label="Resize signature"
            className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border border-white bg-blue-500 shadow"
            style={{ cursor: 'nwse-resize' }}
            onPointerDown={startResize}
          />
        </>
      )}
    </div>
  )
}
