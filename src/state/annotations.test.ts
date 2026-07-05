import { describe, expect, it } from 'vitest'
import { annotationReducer, emptyHistory, type AnnotationHistory } from './annotations'
import type { HighlightAnnotation, SignatureAnnotation } from '../types'

const YELLOW = { r: 1, g: 0.92, b: 0.23 }

function highlight(id: string): HighlightAnnotation {
  return { id, pageIndex: 0, quads: [{ x: 0, y: 0, width: 10, height: 10 }], color: YELLOW, opacity: 0.4 }
}

function signature(id: string): SignatureAnnotation {
  return {
    id,
    pageIndex: 0,
    rect: { x: 0, y: 0, width: 100, height: 40 },
    image: { dataUrl: 'data:image/png;base64,x', width: 100, height: 40 },
  }
}

function run(...actions: Parameters<typeof annotationReducer>[1][]): AnnotationHistory {
  return actions.reduce(annotationReducer, emptyHistory)
}

describe('annotationReducer', () => {
  it('adds and removes highlights', () => {
    const added = run({ type: 'add-highlights', highlights: [highlight('h1'), highlight('h2')] })
    expect(added.present.highlights).toHaveLength(2)

    const removed = annotationReducer(added, { type: 'remove-highlight', id: 'h1' })
    expect(removed.present.highlights.map((h) => h.id)).toEqual(['h2'])
  })

  it('moves signatures', () => {
    const state = run(
      { type: 'add-signature', signature: signature('s1') },
      { type: 'move-signature', id: 's1', rect: { x: 5, y: 6, width: 100, height: 40 } },
    )
    expect(state.present.signatures[0].rect).toEqual({ x: 5, y: 6, width: 100, height: 40 })
  })

  it('undo/redo walk the history and edits clear the redo stack', () => {
    const two = run(
      { type: 'add-highlights', highlights: [highlight('h1')] },
      { type: 'add-highlights', highlights: [highlight('h2')] },
    )

    const undone = annotationReducer(two, { type: 'undo' })
    expect(undone.present.highlights.map((h) => h.id)).toEqual(['h1'])

    const redone = annotationReducer(undone, { type: 'redo' })
    expect(redone.present.highlights.map((h) => h.id)).toEqual(['h1', 'h2'])

    const branched = annotationReducer(undone, { type: 'add-highlights', highlights: [highlight('h3')] })
    expect(branched.future).toHaveLength(0)
    expect(annotationReducer(branched, { type: 'redo' })).toBe(branched)
  })

  it('undo at the bottom of the stack is a no-op', () => {
    expect(annotationReducer(emptyHistory, { type: 'undo' })).toBe(emptyHistory)
  })

  it('no-op edits do not pollute the undo stack', () => {
    const state = run(
      { type: 'add-highlights', highlights: [highlight('h1')] },
      { type: 'remove-highlight', id: 'nonexistent' },
    )
    expect(state.past).toHaveLength(1)
  })
})
