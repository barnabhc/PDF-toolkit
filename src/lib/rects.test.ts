import { describe, expect, it } from 'vitest'
import { dropContainedRects, dropTinyRects } from './rects'

describe('dropContainedRects', () => {
  it('drops rects fully inside another', () => {
    const outer = { x: 0, y: 0, width: 100, height: 20 }
    const inner = { x: 10, y: 5, width: 30, height: 10 }
    expect(dropContainedRects([outer, inner])).toEqual([outer])
  })

  it('keeps partially overlapping rects', () => {
    const a = { x: 0, y: 0, width: 100, height: 20 }
    const b = { x: 50, y: 10, width: 100, height: 20 }
    expect(dropContainedRects([a, b])).toEqual([a, b])
  })

  it('keeps exactly one of two identical rects', () => {
    const a = { x: 0, y: 0, width: 100, height: 20 }
    expect(dropContainedRects([a, { ...a }])).toHaveLength(1)
  })

  it('tolerates sub-pixel jitter', () => {
    const outer = { x: 0, y: 0, width: 100, height: 20 }
    const jittered = { x: -0.5, y: 0.25, width: 100.4, height: 20.1 }
    expect(dropContainedRects([outer, jittered])).toHaveLength(1)
  })
})

describe('dropTinyRects', () => {
  it('filters selection noise', () => {
    const real = { x: 0, y: 0, width: 50, height: 12 }
    const noise = { x: 5, y: 5, width: 1, height: 12 }
    expect(dropTinyRects([real, noise])).toEqual([real])
  })
})
