import type { HighlightAnnotation, PdfRect, SignatureAnnotation } from '../types'

export interface AnnotationSet {
  highlights: HighlightAnnotation[]
  signatures: SignatureAnnotation[]
}

/** Undo/redo over full annotation snapshots (they're small — ids and rects). */
export interface AnnotationHistory {
  past: AnnotationSet[]
  present: AnnotationSet
  future: AnnotationSet[]
}

export type AnnotationAction =
  | { type: 'add-highlights'; highlights: HighlightAnnotation[] }
  | { type: 'remove-highlight'; id: string }
  | { type: 'add-signature'; signature: SignatureAnnotation }
  | { type: 'move-signature'; id: string; rect: PdfRect }
  | { type: 'remove-signature'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }

const HISTORY_LIMIT = 100

const EMPTY_SET: AnnotationSet = { highlights: [], signatures: [] }

export const emptyHistory: AnnotationHistory = { past: [], present: EMPTY_SET, future: [] }

export function annotationReducer(state: AnnotationHistory, action: AnnotationAction): AnnotationHistory {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      }
    }
    case 'reset':
      return emptyHistory
    default: {
      const updated = applyEdit(state.present, action)
      if (updated === state.present) return state
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: updated,
        future: [],
      }
    }
  }
}

function applyEdit(present: AnnotationSet, action: AnnotationAction): AnnotationSet {
  switch (action.type) {
    case 'add-highlights':
      if (action.highlights.length === 0) return present
      return { ...present, highlights: [...present.highlights, ...action.highlights] }
    case 'remove-highlight': {
      const highlights = present.highlights.filter((h) => h.id !== action.id)
      return highlights.length === present.highlights.length ? present : { ...present, highlights }
    }
    case 'add-signature':
      return { ...present, signatures: [...present.signatures, action.signature] }
    case 'move-signature': {
      const signatures = present.signatures.map((s) => (s.id === action.id ? { ...s, rect: action.rect } : s))
      return { ...present, signatures }
    }
    case 'remove-signature': {
      const signatures = present.signatures.filter((s) => s.id !== action.id)
      return signatures.length === present.signatures.length ? present : { ...present, signatures }
    }
    default:
      return present
  }
}

export function hasAnnotations(set: AnnotationSet): boolean {
  return set.highlights.length > 0 || set.signatures.length > 0
}
