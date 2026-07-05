import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { describeLoadError, loadDocument, type LoadedDocument } from '../lib/loadDocument'
import { pickPdfFiles, savePdfBytes } from '../lib/fileAccess'
import {
  annotationReducer,
  emptyHistory,
  type AnnotationAction,
  type AnnotationHistory,
  type AnnotationSet,
} from '../state/annotations'
import { HIGHLIGHT_COLORS, MAX_SCALE, MIN_SCALE, ZOOM_LEVELS, clamp } from '../constants'
import type { EditorSelection, RGB, SignatureImage, Tool } from '../types'

interface EditorContextValue {
  doc: LoadedDocument | null
  busy: string | null
  error: string | null
  dismissError(): void

  scale: number
  zoomIn(): void
  zoomOut(): void
  fitWidth(): void
  /** Attached by Viewer to its scroll container; used for fit-width and scrolling. */
  viewerRef: RefObject<HTMLDivElement | null>

  tool: Tool
  setTool(tool: Tool): void
  highlightColor: RGB
  setHighlightColor(color: RGB): void

  annotations: AnnotationHistory
  dispatchAnnotations(action: AnnotationAction): void
  canUndo: boolean
  canRedo: boolean

  pendingSignature: SignatureImage | null
  setPendingSignature(signature: SignatureImage | null): void
  selection: EditorSelection | null
  setSelection(selection: EditorSelection | null): void

  currentPage: number
  setCurrentPage(page: number): void
  scrollTarget: { page: number; nonce: number } | null
  scrollToPage(page: number): void

  signatureModalOpen: boolean
  setSignatureModalOpen(open: boolean): void
  mergeModalOpen: boolean
  setMergeModalOpen(open: boolean): void

  openDocumentFiles(files: File[]): Promise<void>
  openDocumentPicker(): Promise<void>
  closeDocument(): void
  saveDocument(): Promise<void>
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used inside <EditorProvider>')
  return value
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<LoadedDocument | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [tool, setTool] = useState<Tool>('select')
  const [highlightColor, setHighlightColor] = useState<RGB>(HIGHLIGHT_COLORS[0].color)
  const [annotations, dispatchAnnotations] = useReducer(annotationReducer, emptyHistory)
  const [pendingSignature, setPendingSignature] = useState<SignatureImage | null>(null)
  const [selection, setSelection] = useState<EditorSelection | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scrollTarget, setScrollTarget] = useState<{ page: number; nonce: number } | null>(null)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)

  const viewerRef = useRef<HTMLDivElement | null>(null)
  const lastSavedSet = useRef<AnnotationSet>(emptyHistory.present)

  const dismissError = useCallback(() => setError(null), [])

  const setScaleClamped = useCallback((value: number) => {
    setScale(clamp(value, MIN_SCALE, MAX_SCALE))
  }, [])

  const zoomIn = useCallback(() => {
    setScale((current) => ZOOM_LEVELS.find((level) => level > current + 1e-3) ?? ZOOM_LEVELS.at(-1)!)
  }, [])

  const zoomOut = useCallback(() => {
    setScale((current) => [...ZOOM_LEVELS].reverse().find((level) => level < current - 1e-3) ?? ZOOM_LEVELS[0])
  }, [])

  const fitWidth = useCallback(() => {
    const container = viewerRef.current
    if (!container || !doc || doc.pages.length === 0) return
    const available = container.clientWidth - 64
    const widest = Math.max(...doc.pages.map((page) => page.baseWidth))
    setScaleClamped(available / widest)
  }, [doc, setScaleClamped])

  const scrollToPage = useCallback(
    (page: number) => {
      const total = doc?.pdf.numPages ?? 1
      const target = clamp(Math.round(page), 1, total)
      setCurrentPage(target)
      setScrollTarget({ page: target, nonce: Date.now() })
    },
    [doc],
  )

  const resetEditingState = useCallback(() => {
    dispatchAnnotations({ type: 'reset' })
    lastSavedSet.current = emptyHistory.present
    setSelection(null)
    setPendingSignature(null)
    setTool('select')
    setCurrentPage(1)
    setScrollTarget(null)
  }, [])

  const openDocumentFiles = useCallback(
    async (files: File[]) => {
      const file = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      if (!file) {
        setError('That file is not a PDF.')
        return
      }
      setBusy('Opening…')
      setError(null)
      try {
        const data = await file.arrayBuffer()
        const loaded = await loadDocument(data, file.name, (isRetry) =>
          window.prompt(
            isRetry
              ? 'Incorrect password. Enter the password for this PDF:'
              : 'This PDF is password-protected. Enter the password to view it:',
          ),
        )
        doc?.pdf.destroy().catch(() => undefined)
        resetEditingState()
        setDoc(loaded)
      } catch (loadError) {
        setError(describeLoadError(loadError))
      } finally {
        setBusy(null)
      }
    },
    [doc, resetEditingState],
  )

  const openDocumentPicker = useCallback(async () => {
    const files = await pickPdfFiles(false)
    if (files.length > 0) await openDocumentFiles(files)
  }, [openDocumentFiles])

  const closeDocument = useCallback(() => {
    doc?.pdf.destroy().catch(() => undefined)
    setDoc(null)
    resetEditingState()
  }, [doc, resetEditingState])

  /**
   * Writes annotations into a copy of the original bytes and saves it.
   * `doc.bytes` stays untouched, so saving is idempotent: the same state
   * always produces the same output, and editing can simply continue.
   */
  const saveDocument = useCallback(async () => {
    if (!doc || doc.encrypted || busy) return
    setBusy('Saving…')
    setError(null)
    try {
      const { highlights, signatures } = annotations.present
      // Dynamic import keeps pdf-lib out of the initial (viewer-only) bundle.
      const { writeAnnotatedPdf } = await import('../lib/pdf/saveDocument')
      const bytes = await writeAnnotatedPdf(doc.bytes, highlights, signatures)
      const suggestedName = doc.name.replace(/\.pdf$/i, '') + '-edited.pdf'
      const saved = await savePdfBytes(bytes, suggestedName)
      if (saved) lastSavedSet.current = annotations.present
    } catch (saveError) {
      console.error(saveError)
      setError('Could not save the PDF. The file may use features this tool does not support yet.')
    } finally {
      setBusy(null)
    }
  }, [doc, busy, annotations])

  const guardedDispatch = useCallback(
    (action: AnnotationAction) => {
      if (doc?.encrypted && action.type !== 'reset') return
      dispatchAnnotations(action)
    },
    [doc],
  )

  // Installed-PWA path: PDFs the OS asks us to open (double-clicked files when
  // the app is the default .pdf handler) arrive through the launch queue.
  useEffect(() => {
    if (!window.launchQueue) return
    window.launchQueue.setConsumer(async (launchParams) => {
      if (launchParams.files.length === 0) return
      const files = await Promise.all(launchParams.files.map((handle) => handle.getFile()))
      void openDocumentFiles(files)
    })
  }, [openDocumentFiles])

  // Warn before losing unsaved annotations.
  const isDirty = annotations.present !== lastSavedSet.current
  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        guardedDispatch({ type: 'undo' })
      } else if ((mod && key === 'y') || (mod && key === 'z' && event.shiftKey)) {
        event.preventDefault()
        guardedDispatch({ type: 'redo' })
      } else if (mod && key === 'o') {
        event.preventDefault()
        void openDocumentPicker()
      } else if (mod && key === 's') {
        event.preventDefault()
        void saveDocument()
      } else if (event.key === 'Escape') {
        if (signatureModalOpen) setSignatureModalOpen(false)
        else if (mergeModalOpen) setMergeModalOpen(false)
        else if (pendingSignature) setPendingSignature(null)
        else setSelection(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault()
        guardedDispatch(
          selection.kind === 'highlight'
            ? { type: 'remove-highlight', id: selection.id }
            : { type: 'remove-signature', id: selection.id },
        )
        setSelection(null)
      } else if (!mod && doc && (event.key === '+' || event.key === '=')) {
        zoomIn()
      } else if (!mod && doc && event.key === '-') {
        zoomOut()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    doc,
    guardedDispatch,
    mergeModalOpen,
    openDocumentPicker,
    pendingSignature,
    saveDocument,
    selection,
    signatureModalOpen,
    zoomIn,
    zoomOut,
  ])

  const value = useMemo<EditorContextValue>(
    () => ({
      doc,
      busy,
      error,
      dismissError,
      scale,
      zoomIn,
      zoomOut,
      fitWidth,
      viewerRef,
      tool,
      setTool,
      highlightColor,
      setHighlightColor,
      annotations,
      dispatchAnnotations: guardedDispatch,
      canUndo: annotations.past.length > 0,
      canRedo: annotations.future.length > 0,
      pendingSignature,
      setPendingSignature,
      selection,
      setSelection,
      currentPage,
      setCurrentPage,
      scrollTarget,
      scrollToPage,
      signatureModalOpen,
      setSignatureModalOpen,
      mergeModalOpen,
      setMergeModalOpen,
      openDocumentFiles,
      openDocumentPicker,
      closeDocument,
      saveDocument,
    }),
    [
      doc,
      busy,
      error,
      dismissError,
      scale,
      zoomIn,
      zoomOut,
      fitWidth,
      tool,
      highlightColor,
      annotations,
      guardedDispatch,
      pendingSignature,
      selection,
      currentPage,
      scrollTarget,
      scrollToPage,
      signatureModalOpen,
      mergeModalOpen,
      openDocumentFiles,
      openDocumentPicker,
      closeDocument,
      saveDocument,
    ],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
