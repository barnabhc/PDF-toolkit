import type { RGB } from './types'

export const HIGHLIGHT_COLORS: { name: string; color: RGB }[] = [
  { name: 'Yellow', color: { r: 1, g: 0.85, b: 0.2 } },
  { name: 'Green', color: { r: 0.45, g: 0.85, b: 0.4 } },
  { name: 'Blue', color: { r: 0.4, g: 0.7, b: 1 } },
  { name: 'Pink', color: { r: 1, g: 0.55, b: 0.75 } },
]

export const HIGHLIGHT_OPACITY = 0.4

export const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]
export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

export function cssColor(color: RGB): string {
  const channel = (value: number) => Math.round(value * 255)
  return `rgb(${channel(color.r)} ${channel(color.g)} ${channel(color.b)})`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
