import { useEditor } from '../context/EditorContext'
import { pdfToCssRect } from '../lib/coords'
import { cssColor } from '../constants'

export function HighlightsOverlay({ pageIndex }: { pageIndex: number }) {
  const { doc, scale, annotations, tool, selection, setSelection, dispatchAnnotations } = useEditor()
  const highlights = annotations.present.highlights.filter((h) => h.pageIndex === pageIndex)
  if (highlights.length === 0) return null

  const geometry = doc!.pages[pageIndex].geometry
  // While the highlighter is active the quads must not swallow text selection.
  const interactive = tool === 'select'

  return (
    <div className="pointer-events-none absolute inset-0">
      {highlights.map((highlight) => {
        const quads = highlight.quads.map((quad) => pdfToCssRect(quad, geometry, scale))
        const selected = selection?.kind === 'highlight' && selection.id === highlight.id
        return (
          <div key={highlight.id}>
            {quads.map((quad, quadIndex) => (
              <div
                key={quadIndex}
                role={interactive ? 'button' : undefined}
                aria-label="Highlight"
                onClick={(event) => {
                  event.stopPropagation()
                  setSelection({ kind: 'highlight', id: highlight.id })
                }}
                style={{
                  position: 'absolute',
                  left: quad.x,
                  top: quad.y,
                  width: quad.width,
                  height: quad.height,
                  backgroundColor: cssColor(highlight.color),
                  opacity: highlight.opacity,
                  mixBlendMode: 'multiply',
                  pointerEvents: interactive ? 'auto' : 'none',
                  cursor: interactive ? 'pointer' : undefined,
                  outline: selected ? '2px solid rgb(59 130 246)' : undefined,
                }}
              />
            ))}
            {selected && interactive && (
              <button
                className="pointer-events-auto absolute z-10 rounded bg-zinc-800 px-2 py-0.5 text-xs text-white shadow hover:bg-red-600"
                style={{
                  left: quads[0].x,
                  top: Math.max(2, quads[0].y - 26),
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  dispatchAnnotations({ type: 'remove-highlight', id: highlight.id })
                  setSelection(null)
                }}
              >
                Remove
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
