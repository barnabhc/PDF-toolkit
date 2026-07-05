// Headless end-to-end smoke test against the production build (dist/).
// Covers: drop-to-open, page + text-layer rendering, highlighting on a normal
// and a rotated page (with a geometry assertion), and typed-signature placement.
//
// Usage: npm run build && node scripts/make-sample-pdf.mjs && node scripts/smoke.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4173
const screenshotPath = process.env.SMOKE_SCREENSHOT ?? join(root, 'smoke.png')

const failures = []
const consoleErrors = []

function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

async function waitForServer(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Server at ${url} did not come up`)
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

try {
  await waitForServer(`http://localhost:${PORT}`)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`)
  })

  await page.goto(`http://localhost:${PORT}`)
  check('app loads', await page.getByRole('button', { name: 'Open a PDF' }).isVisible())

  // --- Open via drag & drop (the picker paths need native dialogs) ---
  const pdfBase64 = readFileSync(join(root, 'samples', 'sample.pdf')).toString('base64')
  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'sample.pdf', { type: 'application/pdf' })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    document
      .querySelector('#root > div')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
  }, pdfBase64)

  await page.waitForSelector('canvas[aria-label="Page 1"]', { timeout: 15_000 })
  await page.waitForFunction(() => document.querySelectorAll('[data-page-index="0"] .textLayer span').length > 0, null, {
    timeout: 15_000,
  })
  check('page 1 renders with a text layer', true)

  const pageBoxes = await page.evaluate(() =>
    [0, 1, 2].map((index) => {
      const el = document.querySelector(`[data-page-index="${index}"]`)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  check('three pages laid out', pageBoxes.every(Boolean), JSON.stringify(pageBoxes))
  check(
    'rotated page 2 is landscape',
    pageBoxes[1] && pageBoxes[1].width > pageBoxes[1].height,
    `page 2: ${Math.round(pageBoxes[1].width)}×${Math.round(pageBoxes[1].height)}`,
  )

  // --- Highlight on a page: select a text span, then mouseup with the tool active ---
  async function highlightSpanOn(pageIndex) {
    await page.evaluate((index) => {
      const span = document.querySelector(`[data-page-index="${index}"] .textLayer span`)
      const selection = window.getSelection()
      selection.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(span)
      selection.addRange(range)
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      const rect = span.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }, pageIndex)
    // Span rect must be re-read before the selection is cleared, so grab it first.
  }

  await page.getByRole('button', { name: 'Highlight', exact: true }).click()

  // Page 1 (unrotated)
  const span0 = await page.evaluate(() => {
    const span = document.querySelector('[data-page-index="0"] .textLayer span')
    const rect = span.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  await highlightSpanOn(0)
  await page.waitForSelector('[aria-label="Highlight"]', { timeout: 5_000 })
  const quad0 = await page.evaluate(() => {
    const quad = document.querySelector('[data-page-index="0"] [aria-label="Highlight"]')
    if (!quad) return null
    const rect = quad.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const closeTo = (a, b, tolerance = 3) => Math.abs(a - b) <= tolerance
  check(
    'highlight quad lands on the selected text (page 1)',
    quad0 && closeTo(quad0.x, span0.x) && closeTo(quad0.y, span0.y) && closeTo(quad0.width, span0.width, 5),
    `span=${JSON.stringify(span0)} quad=${JSON.stringify(quad0)}`,
  )

  // Page 2 (rotated 90°) — the coordinate-mapping stress case.
  const span1 = await page.evaluate(() => {
    const span = document.querySelector('[data-page-index="1"] .textLayer span')
    const rect = span.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  await highlightSpanOn(1)
  const quad1 = await page.waitForFunction(() => {
    const quad = document.querySelector('[data-page-index="1"] [aria-label="Highlight"]')
    if (!quad) return null
    const rect = quad.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }, null, { timeout: 5_000 })
  const quad1Box = await quad1.jsonValue()
  check(
    'highlight quad lands on the selected text (rotated page 2)',
    quad1Box && closeTo(quad1Box.x, span1.x) && closeTo(quad1Box.y, span1.y),
    `span=${JSON.stringify(span1)} quad=${JSON.stringify(quad1Box)}`,
  )

  // --- Undo removes the last highlight ---
  await page.locator('button[title="Undo (Ctrl+Z)"]').click()
  const highlightCountAfterUndo = await page.locator('[aria-label="Highlight"]').count()
  check('undo removes the rotated-page highlight', highlightCountAfterUndo === 1, `count=${highlightCountAfterUndo}`)

  // --- Typed signature placed on page 1 ---
  await page.getByRole('button', { name: 'Sign' }).click()
  await page.getByRole('tab', { name: 'Type' }).click()
  await page.getByLabel('Signature text').fill('Barnab H.')
  await page.getByRole('button', { name: 'Use signature' }).click()
  const pageOne = await page.locator('[data-page-index="0"]').boundingBox()
  await page.mouse.click(pageOne.x + pageOne.width / 2, pageOne.y + pageOne.height / 2)
  await page.waitForSelector('img[alt="Signature"]', { timeout: 5_000 })
  check('typed signature placed on the page', true)

  await page.screenshot({ path: screenshotPath })
  console.log(`Screenshot: ${screenshotPath}`)

  await browser.close()
} finally {
  preview.kill()
}

const fatalConsole = consoleErrors.filter((line) => !line.includes('favicon'))
check('no console/page errors', fatalConsole.length === 0, fatalConsole.slice(0, 5).join(' | '))

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke checks passed')
