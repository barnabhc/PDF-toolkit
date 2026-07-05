import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Modal } from './Modal'
import { useEditor } from '../context/EditorContext'
import { SIGNATURE_FONT, SIGNATURE_INK, readImageFile, renderTextSignature, trimTransparentEdges } from '../lib/canvas'
import { forgetSignature, loadSavedSignatures, rememberSignature } from '../lib/signatureStore'
import type { SignatureImage } from '../types'

type TabId = 'saved' | 'draw' | 'type' | 'upload'

export function SignatureModal() {
  const { doc, setSignatureModalOpen, setPendingSignature } = useEditor()
  const [saved, setSaved] = useState<SignatureImage[]>(loadSavedSignatures)
  const [tab, setTab] = useState<TabId>(saved.length > 0 ? 'saved' : 'draw')

  const close = () => setSignatureModalOpen(false)

  const useSignature = (image: SignatureImage, remember: boolean) => {
    if (remember) setSaved(rememberSignature(image))
    if (doc && !doc.encrypted) setPendingSignature(image)
    close()
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'saved', label: `Saved (${saved.length})` },
    { id: 'draw', label: 'Draw' },
    { id: 'type', label: 'Type' },
    { id: 'upload', label: 'Upload' },
  ]

  return (
    <Modal title="Add a signature" onClose={close}>
      <div className="flex flex-col gap-4">
        <div role="tablist" className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === id ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!doc && <p className="text-xs text-amber-700">Open a PDF first — the signature will be ready to place.</p>}
        {doc?.encrypted && <p className="text-xs text-amber-700">This PDF is view-only (encrypted); signatures can't be placed.</p>}

        {tab === 'saved' && (
          <SavedTab
            saved={saved}
            onUse={(image) => useSignature(image, false)}
            onForget={(dataUrl) => setSaved(forgetSignature(dataUrl))}
          />
        )}
        {tab === 'draw' && <DrawTab onUse={(image) => useSignature(image, true)} />}
        {tab === 'type' && <TypeTab onUse={(image) => useSignature(image, true)} />}
        {tab === 'upload' && <UploadTab onUse={(image) => useSignature(image, true)} />}

        <p className="text-xs text-zinc-400">
          This places an image of your signature — it is not a cryptographic digital signature. Saved signatures are
          stored only in this browser.
        </p>
      </div>
    </Modal>
  )
}

function SavedTab({
  saved,
  onUse,
  onForget,
}: {
  saved: SignatureImage[]
  onUse: (image: SignatureImage) => void
  onForget: (dataUrl: string) => void
}) {
  if (saved.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">No saved signatures yet — draw, type, or upload one.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {saved.map((image) => (
        <div key={image.dataUrl} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3">
          <button
            type="button"
            onClick={() => onUse(image)}
            title="Use this signature"
            className="grid h-20 place-items-center rounded bg-zinc-50 hover:bg-blue-50"
          >
            <img src={image.dataUrl} alt="Saved signature" className="max-h-16 max-w-full" draggable={false} />
          </button>
          <div className="flex justify-between">
            <button type="button" onClick={() => onUse(image)} className="text-xs font-medium text-blue-600 hover:underline">
              Use
            </button>
            <button type="button" onClick={() => onForget(image.dataUrl)} className="text-xs text-zinc-400 hover:text-red-600">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DrawTab({ onUse }: { onUse: (image: SignatureImage) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hasInk, setHasInk] = useState(false)

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const bounds = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    }
  }

  const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    context.strokeStyle = SIGNATURE_INK
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'

    const start = canvasPoint(event)
    context.beginPath()
    context.moveTo(start.x, start.y)
    // A dot for a click without movement.
    context.lineTo(start.x + 0.1, start.y + 0.1)
    context.stroke()
    setHasInk(true)

    const onMove = (move: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(move)
      context.lineTo(point.x, point.y)
      context.stroke()
    }
    const canvasEl = canvas
    const domMove = (domEvent: globalThis.PointerEvent) => onMove(domEvent as unknown as ReactPointerEvent<HTMLCanvasElement>)
    canvasEl.setPointerCapture(event.pointerId)
    canvasEl.addEventListener('pointermove', domMove)
    canvasEl.addEventListener('pointerup', () => canvasEl.removeEventListener('pointermove', domMove), { once: true })
  }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  const use = () => {
    const trimmed = trimTransparentEdges(canvasRef.current!)
    onUse({ dataUrl: trimmed.toDataURL('image/png'), width: trimmed.width, height: trimmed.height })
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={520}
        height={180}
        onPointerDown={startStroke}
        className="w-full cursor-crosshair touch-none rounded-lg border border-dashed border-zinc-300 bg-zinc-50"
        aria-label="Signature drawing area"
      />
      <div className="flex justify-between">
        <button type="button" onClick={clear} className="text-sm text-zinc-500 hover:text-zinc-800">
          Clear
        </button>
        <UseButton onClick={use} disabled={!hasInk} />
      </div>
    </div>
  )
}

function TypeTab({ onUse }: { onUse: (image: SignatureImage) => void }) {
  const [text, setText] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type your name"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        aria-label="Signature text"
      />
      <div className="grid h-24 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50">
        <span style={{ fontFamily: SIGNATURE_FONT, fontSize: 36, color: SIGNATURE_INK }}>{text || '…'}</span>
      </div>
      <div className="flex justify-end">
        <UseButton onClick={() => onUse(renderTextSignature(text.trim()))} disabled={text.trim().length === 0} />
      </div>
    </div>
  )
}

function UploadTab({ onUse }: { onUse: (image: SignatureImage) => void }) {
  const [preview, setPreview] = useState<SignatureImage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null)
    readImageFile(file)
      .then(setPreview)
      .catch((readError: Error) => setError(readError.message))
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="grid h-24 cursor-pointer place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 hover:bg-zinc-100">
        {preview ? (
          <img src={preview.dataUrl} alt="Signature preview" className="max-h-20 max-w-full" draggable={false} />
        ) : (
          'Choose a PNG or JPEG…'
        )}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <UseButton onClick={() => preview && onUse(preview)} disabled={!preview} />
      </div>
    </div>
  )
}

function UseButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Use signature
    </button>
  )
}
