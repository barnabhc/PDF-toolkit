// Verifies the PWA essentials against the production build (dist/):
// manifest content (icons, file_handlers), service worker registration and
// control, and — the point of it all — that the app still loads fully offline.
//
// Usage: npm run build && node scripts/verify-pwa.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4174
const failures = []

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

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })

try {
  const origin = `http://localhost:${PORT}`
  await waitForServer(origin)
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(origin)

  // Manifest
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href')
  check('manifest is linked', Boolean(manifestHref), String(manifestHref))
  const manifest = await (await fetch(new URL(manifestHref, origin))).json()
  check('manifest: standalone display', manifest.display === 'standalone')
  check(
    'manifest: 192/512/maskable icons',
    ['192x192', '512x512'].every((size) => manifest.icons?.some((icon) => icon.sizes === size)) &&
      manifest.icons?.some((icon) => icon.purpose === 'maskable'),
  )
  check(
    'manifest: registers as .pdf file handler',
    manifest.file_handlers?.[0]?.accept?.['application/pdf']?.includes('.pdf'),
    JSON.stringify(manifest.file_handlers),
  )
  for (const icon of manifest.icons ?? []) {
    const response = await fetch(new URL(icon.src, origin))
    check(`icon ${icon.src} is served`, response.ok)
  }

  // Service worker registers and takes control
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15_000 })
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active?.state === 'activated'
    },
    null,
    { timeout: 15_000 },
  )
  await page.reload()
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  check('service worker controls the page after reload', controlled)

  // The whole point: works with the network gone.
  await context.setOffline(true)
  await page.reload()
  const offlineWorks = await page.getByRole('button', { name: 'Open a PDF' }).isVisible()
  check('app loads fully OFFLINE', offlineWorks)
  await context.setOffline(false)

  await browser.close()
} finally {
  preview.kill()
}

if (failures.length > 0) {
  console.error(`\n${failures.length} PWA check(s) failed`)
  process.exit(1)
}
console.log('\nAll PWA checks passed')
