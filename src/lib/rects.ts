import type { CssRect } from '../types'

/**
 * The browser reports overlapping/duplicate client rects for a text selection
 * (nested spans each contribute one). Drop rects fully contained in another
 * so a highlight becomes one clean quad per line fragment.
 */
export function dropContainedRects(rects: CssRect[], tolerance = 1): CssRect[] {
  return rects.filter((rect, index) =>
    !rects.some((other, otherIndex) => otherIndex !== index && contains(other, rect, tolerance) &&
      // Of two identical rects, keep the first.
      !(contains(rect, other, tolerance) && index < otherIndex)),
  )
}

function contains(outer: CssRect, inner: CssRect, tolerance: number): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  )
}

/** Rects smaller than a couple of pixels are selection noise, not text. */
export function dropTinyRects(rects: CssRect[], minSize = 2): CssRect[] {
  return rects.filter((rect) => rect.width >= minSize && rect.height >= minSize)
}
