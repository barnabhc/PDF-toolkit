import { useEffect, useState, type ReactNode } from 'react'
import { useEditor } from '../context/EditorContext'
import { HIGHLIGHT_COLORS, cssColor } from '../constants'

export function Toolbar() {
  const {
    doc,
    busy,
    openDocumentPicker,
    closeDocument,
    saveDocument,
    scale,
    zoomIn,
    zoomOut,
    fitWidth,
    currentPage,
    scrollToPage,
    tool,
    setTool,
    highlightColor,
    setHighlightColor,
    setSignatureModalOpen,
    setMergeModalOpen,
    dispatchAnnotations,
    canUndo,
    canRedo,
  } = useEditor()

  const numPages = doc?.pdf.numPages ?? 0
  const editable = Boolean(doc) && !doc!.encrypted

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-300 bg-white px-4 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tracking-tight text-zinc-800">PDF Toolkit</span>
        <PrivacyBadge />
      </div>

      <Group>
        <Button onClick={() => void openDocumentPicker()} disabled={Boolean(busy)}>
          Open
        </Button>
        <Button onClick={() => setMergeModalOpen(true)} disabled={Boolean(busy)}>
          Merge
        </Button>
        {doc && (
          <Button onClick={() => void saveDocument()} disabled={!editable || Boolean(busy)} primary
            title={editable ? 'Write highlights and signatures into a new PDF' : 'Encrypted PDFs are view-only'}>
            Save
          </Button>
        )}
      </Group>

      {doc && (
        <>
          <Group aria-label="Zoom">
            <Button onClick={zoomOut} title="Zoom out (-)">−</Button>
            <span className="w-12 text-center text-sm tabular-nums text-zinc-600">{Math.round(scale * 100)}%</span>
            <Button onClick={zoomIn} title="Zoom in (+)">+</Button>
            <Button onClick={fitWidth} title="Fit page width">Fit</Button>
          </Group>

          <Group aria-label="Page navigation">
            <PageInput current={currentPage} total={numPages} onJump={scrollToPage} />
          </Group>

          {editable && (
            <Group aria-label="Tools">
              <Button active={tool === 'select'} onClick={() => setTool('select')} title="Select and move annotations">
                Select
              </Button>
              <Button active={tool === 'highlight'} onClick={() => setTool('highlight')} title="Select text to highlight it">
                Highlight
              </Button>
              {tool === 'highlight' && (
                <span className="flex items-center gap-1 pl-1" role="radiogroup" aria-label="Highlight color">
                  {HIGHLIGHT_COLORS.map(({ name, color }) => {
                    const activeColor = cssColor(color) === cssColor(highlightColor)
                    return (
                      <button
                        key={name}
                        role="radio"
                        aria-checked={activeColor}
                        title={name}
                        onClick={() => setHighlightColor(color)}
                        className={`h-5 w-5 rounded-full border ${activeColor ? 'border-zinc-700 ring-2 ring-blue-400' : 'border-zinc-300'}`}
                        style={{ backgroundColor: cssColor(color) }}
                      />
                    )
                  })}
                </span>
              )}
              <Button onClick={() => setSignatureModalOpen(true)}>Sign</Button>
            </Group>
          )}

          {editable && (
            <Group aria-label="History">
              <Button onClick={() => dispatchAnnotations({ type: 'undo' })} disabled={!canUndo} title="Undo (Ctrl+Z)">
                ↶
              </Button>
              <Button onClick={() => dispatchAnnotations({ type: 'redo' })} disabled={!canRedo} title="Redo (Ctrl+Y)">
                ↷
              </Button>
            </Group>
          )}

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {doc.encrypted && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title="Editing encrypted PDFs is not supported yet">
                🔒 View-only
              </span>
            )}
            <span className="max-w-56 truncate text-sm text-zinc-500" title={doc.name}>
              {doc.name}
            </span>
            <Button onClick={closeDocument} title="Close document">✕</Button>
          </div>
        </>
      )}
    </header>
  )
}

function Group({ children, ...rest }: { children: ReactNode } & Record<string, unknown>) {
  return (
    <div className="flex items-center gap-1 border-l border-zinc-200 pl-4 first:border-l-0 first:pl-0" {...rest}>
      {children}
    </div>
  )
}

function Button({
  children,
  onClick,
  disabled,
  active,
  primary,
  title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  primary?: boolean
  title?: string
}) {
  const base = 'rounded-md px-2.5 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const look = primary
    ? 'bg-blue-600 font-medium text-white hover:bg-blue-500'
    : active
      ? 'bg-blue-100 font-medium text-blue-700'
      : 'text-zinc-700 hover:bg-zinc-100'
  return (
    <button type="button" className={`${base} ${look}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

function PageInput({ current, total, onJump }: { current: number; total: number; onJump: (page: number) => void }) {
  const [draft, setDraft] = useState(String(current))
  useEffect(() => setDraft(String(current)), [current])

  const jump = () => {
    const page = Number.parseInt(draft, 10)
    if (Number.isFinite(page)) onJump(page)
    else setDraft(String(current))
  }

  return (
    <span className="flex items-center gap-1 text-sm text-zinc-600">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={jump}
        onKeyDown={(event) => event.key === 'Enter' && jump()}
        className="w-10 rounded border border-zinc-300 px-1 py-0.5 text-center text-sm"
        aria-label="Current page"
      />
      <span className="whitespace-nowrap">/ {total}</span>
    </span>
  )
}

function PrivacyBadge() {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
      title="This app is static files with a strict Content-Security-Policy: your PDFs are processed in this tab and never uploaded. Verify in the browser's network panel."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      100% local
    </span>
  )
}
