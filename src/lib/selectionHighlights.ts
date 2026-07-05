import { cssToPdfRect } from './coords'
import { dropContainedRects, dropTinyRects } from './rects'
import { HIGHLIGHT_OPACITY } from '../constants'
import type { LoadedDocument } from './loadDocument'
import type { CssRect, HighlightAnnotation, RGB } from '../types'

/**
 * Turns the current browser text selection into highlight annotations,
 * one per page touched.
 *
 * The selection range is clamped to each page's text layer before reading
 * client rects — a raw cross-page range also "contains" whole elements
 * (canvases, overlays), whose border boxes would become page-sized quads.
 */
export function highlightsFromSelection(
  doc: LoadedDocument,
  pageEls: (HTMLDivElement | null)[],
  scale: number,
  color: RGB,
): HighlightAnnotation[] {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return []

  const highlights: HighlightAnnotation[] = []

  pageEls.forEach((pageEl, pageIndex) => {
    if (!pageEl) return
    const textLayer = pageEl.querySelector('.textLayer')
    if (!textLayer) return

    const cssRects: CssRect[] = []
    const pageBounds = pageEl.getBoundingClientRect()
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i)
      if (!range.intersectsNode(textLayer)) continue
      for (const rect of clampRangeTo(range, textLayer).getClientRects()) {
        cssRects.push({
          x: rect.left - pageBounds.left,
          y: rect.top - pageBounds.top,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    const quadRects = dropContainedRects(dropTinyRects(cssRects))
    if (quadRects.length === 0) return

    const geometry = doc.pages[pageIndex].geometry
    highlights.push({
      id: crypto.randomUUID(),
      pageIndex,
      quads: quadRects.map((rect) => cssToPdfRect(rect, geometry, scale)),
      color,
      opacity: HIGHLIGHT_OPACITY,
    })
  })

  if (highlights.length > 0) selection.removeAllRanges()
  return highlights
}

function clampRangeTo(range: Range, node: Node): Range {
  const clamped = range.cloneRange()
  const nodeRange = document.createRange()
  nodeRange.selectNodeContents(node)
  if (clamped.compareBoundaryPoints(Range.START_TO_START, nodeRange) < 0) {
    clamped.setStart(nodeRange.startContainer, nodeRange.startOffset)
  }
  if (clamped.compareBoundaryPoints(Range.END_TO_END, nodeRange) > 0) {
    clamped.setEnd(nodeRange.endContainer, nodeRange.endOffset)
  }
  return clamped
}
