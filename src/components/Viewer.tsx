import { useCallback, useEffect, useRef } from 'react'
import { useEditor } from '../context/EditorContext'
import { highlightsFromSelection } from '../lib/selectionHighlights'
import { PageView } from './PageView'

export function Viewer() {
  const { doc, scale, viewerRef, fitWidth, tool, highlightColor, dispatchAnnotations, setSelection, scrollTarget, setCurrentPage } =
    useEditor()
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const scrollFrame = useRef(0)

  const registerPage = useCallback((index: number, el: HTMLDivElement | null) => {
    pageEls.current[index] = el
  }, [])

  // Size the freshly opened document to the window once.
  const fittedDoc = useRef<typeof doc>(null)
  useEffect(() => {
    if (doc && fittedDoc.current !== doc) {
      fittedDoc.current = doc
      pageEls.current = []
      fitWidth()
    }
  }, [doc, fitWidth])

  useEffect(() => {
    if (!scrollTarget) return
    const container = viewerRef.current
    const pageEl = pageEls.current[scrollTarget.page - 1]
    if (container && pageEl) container.scrollTo({ top: pageEl.offsetTop - 16 })
  }, [scrollTarget, viewerRef])

  // Track which page is being read (rAF-throttled).
  const handleScroll = useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const container = viewerRef.current
      if (!container) return
      const marker = container.scrollTop + container.clientHeight * 0.35
      let page = 1
      pageEls.current.forEach((el, index) => {
        if (el && el.offsetTop <= marker) page = index + 1
      })
      setCurrentPage(page)
    })
  }, [setCurrentPage, viewerRef])

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), [])

  // Releasing the mouse with the highlighter active turns the selection into highlights.
  const handleMouseUp = useCallback(() => {
    if (!doc || doc.encrypted || tool !== 'highlight') return
    const highlights = highlightsFromSelection(doc, pageEls.current, scale, highlightColor)
    if (highlights.length > 0) dispatchAnnotations({ type: 'add-highlights', highlights })
  }, [doc, tool, scale, highlightColor, dispatchAnnotations])

  if (!doc) return null

  return (
    <div
      ref={viewerRef}
      className={`relative flex-1 overflow-auto bg-zinc-200 ${tool === 'highlight' ? 'tool-highlight' : ''}`}
      onScroll={handleScroll}
      onMouseUp={handleMouseUp}
      onClick={() => setSelection(null)}
    >
      <div className="flex min-h-full flex-col items-center gap-4 px-8 py-6">
        {doc.pages.map((_, index) => (
          <PageView key={index} index={index} registerRef={registerPage} />
        ))}
      </div>
    </div>
  )
}
