// Renders the app icon SVG to the PNG sizes a PWA needs, via headless Chromium.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

// size: canvas size; pad: extra safe-zone padding (maskable); rounded: corner radius
function iconSvg({ size, pad, rounded }) {
  const s = size
  const inner = s - pad * 2
  const u = inner / 100 // design units
  const x = (v) => pad + v * u
  return `<!doctype html><html><body style="margin:0">
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect x="0" y="0" width="${s}" height="${s}" rx="${rounded}" fill="#2563eb"/>
    <!-- document sheet -->
    <path d="M ${x(28)} ${x(14)}
             L ${x(62)} ${x(14)}
             L ${x(74)} ${x(26)}
             L ${x(74)} ${x(86)}
             L ${x(28)} ${x(86)} Z" fill="#ffffff"/>
    <path d="M ${x(62)} ${x(14)} L ${x(62)} ${x(26)} L ${x(74)} ${x(26)} Z" fill="#bfdbfe"/>
    <!-- text lines -->
    <rect x="${x(35)}" y="${x(34)}" width="${26 * u}" height="${5 * u}" rx="${2.5 * u}" fill="#94a3b8"/>
    <rect x="${x(35)}" y="${x(58)}" width="${32 * u}" height="${5 * u}" rx="${2.5 * u}" fill="#94a3b8"/>
    <rect x="${x(35)}" y="${x(70)}" width="${20 * u}" height="${5 * u}" rx="${2.5 * u}" fill="#cbd5e1"/>
    <!-- highlight stroke across the middle line -->
    <rect x="${x(31)}" y="${x(43.5)}" width="${40 * u}" height="${11 * u}" rx="${2 * u}" fill="#fbbf24" opacity="0.9"/>
    <rect x="${x(35)}" y="${x(46)}" width="${32 * u}" height="${5 * u}" rx="${2.5 * u}" fill="#475569"/>
  </svg></body></html>`
}

const browser = await chromium.launch()
const jobs = [
  { file: 'pwa-192x192.png', size: 192, pad: 10, rounded: 36 },
  { file: 'pwa-512x512.png', size: 512, pad: 28, rounded: 96 },
  // Maskable: full-bleed background, artwork inside the ~80% safe zone.
  { file: 'maskable-512x512.png', size: 512, pad: 72, rounded: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 10, rounded: 0 },
]
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } })
  await page.setContent(iconSvg(job))
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: job.size, height: job.size } })
  writeFileSync(join(outDir, job.file), png)
  await page.close()
  console.log('wrote', job.file)
}
await browser.close()

// Favicon: the same artwork as a standalone SVG.
const favicon = iconSvg({ size: 64, pad: 2, rounded: 12 })
  .replace(/^<!doctype html><html><body style="margin:0">\s*/, '')
  .replace(/<\/body><\/html>$/, '')
writeFileSync(join(outDir, 'favicon.svg'), favicon)
console.log('wrote favicon.svg')
