import type { SignatureImage } from '../types'

export const SIGNATURE_FONT = '"Segoe Script", "Brush Script MT", "Comic Sans MS", cursive'
export const SIGNATURE_INK = '#1e293b'

/** Crops a canvas to its non-transparent content plus a small margin. */
export function trimTransparentEdges(canvas: HTMLCanvasElement, margin = 8): HTMLCanvasElement {
  const context = canvas.getContext('2d')
  if (!context || canvas.width === 0 || canvas.height === 0) return canvas
  const { width, height } = canvas
  const alpha = context.getImageData(0, 0, width, height).data

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return canvas // fully transparent

  const cropX = Math.max(0, minX - margin)
  const cropY = Math.max(0, minY - margin)
  const cropWidth = Math.min(width, maxX + margin + 1) - cropX
  const cropHeight = Math.min(height, maxY + margin + 1) - cropY

  const trimmed = document.createElement('canvas')
  trimmed.width = cropWidth
  trimmed.height = cropHeight
  trimmed.getContext('2d')!.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return trimmed
}

/** Renders typed text as a transparent PNG signature image. */
export function renderTextSignature(text: string): SignatureImage {
  const fontSize = 64
  const font = `${fontSize}px ${SIGNATURE_FONT}`

  const measurer = document.createElement('canvas').getContext('2d')!
  measurer.font = font
  const textWidth = Math.ceil(measurer.measureText(text).width)

  const canvas = document.createElement('canvas')
  canvas.width = textWidth + 32
  canvas.height = Math.ceil(fontSize * 1.5)
  const context = canvas.getContext('2d')!
  context.font = font
  context.fillStyle = SIGNATURE_INK
  context.textBaseline = 'middle'
  context.fillText(text, 16, canvas.height / 2)

  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}

/** Reads an uploaded PNG/JPEG file into a signature image with natural dimensions. */
export function readImageFile(file: File): Promise<SignatureImage> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      reject(new Error('Use a PNG or JPEG image (PNG with transparency works best).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const dataUrl = reader.result as string
      const image = new Image()
      image.onload = () => resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('That image could not be decoded.'))
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
