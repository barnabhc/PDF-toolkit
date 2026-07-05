/** RGB color with each channel in [0, 1] (PDF color space convention). */
export interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Rectangle in PDF user space: origin at the bottom-left of the unrotated
 * page, y grows upward, units are PDF points. `x`/`y` name the lower-left corner.
 */
export interface PdfRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Rectangle in CSS pixels relative to the rendered page element:
 * origin at the top-left, y grows downward.
 */
export interface CssRect {
  x: number
  y: number
  width: number
  height: number
}

/** One user text-selection worth of highlight on a single page. */
export interface HighlightAnnotation {
  id: string
  pageIndex: number
  /** One rect per selected line fragment, in PDF user space. */
  quads: PdfRect[]
  color: RGB
  opacity: number
}

export interface SignatureImage {
  dataUrl: string
  /** Natural pixel size of the image, used to preserve aspect ratio. */
  width: number
  height: number
}

export interface SignatureAnnotation {
  id: string
  pageIndex: number
  rect: PdfRect
  image: SignatureImage
}

export type Tool = 'select' | 'highlight'

export interface EditorSelection {
  kind: 'highlight' | 'signature'
  id: string
}
