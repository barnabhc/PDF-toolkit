import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// '/' locally; the deploy workflow sets BASE_PATH=/<repo-name>/ for GitHub Pages.
const base = process.env.BASE_PATH ?? '/'

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

/**
 * Injects a strict no-external-origins CSP into the built index.html.
 * Build-only: the dev server needs inline scripts and websockets for HMR.
 */
function injectCsp(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html: string) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    injectCsp(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PDF Toolkit',
        short_name: 'PDF Toolkit',
        description: 'View, highlight, sign, and merge PDFs — entirely on your device. Nothing is ever uploaded.',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#2563eb',
        background_color: '#f4f4f5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Lets the installed app register as an OS-level handler for .pdf files
        // (Chromium's File Handling API), so users can make it their default opener.
        file_handlers: [{ action: base, accept: { 'application/pdf': ['.pdf'] } }],
        launch_handler: { client_mode: ['focus-existing', 'auto'] },
      },
      workbox: {
        // Precache everything, including the lazy pdf-lib chunk and pdf.js's
        // .mjs worker, so the app is fully usable offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
