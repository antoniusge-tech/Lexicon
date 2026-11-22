import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    /* Installable app + offline start. The service worker precaches the built
       files (public/ icons included); Firestore keeps its own offline cache.
       'prompt': a new deploy waits until the user taps Reload in the toast
       (app.jsx), so an answer in progress is never cut off. Off in dev. */
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // app.jsx registers it (virtual:pwa-register)
      includeManifestIcons: false, // the glob below already precaches them
      manifest: {
        name: 'Lexicon',
        short_name: 'Lexicon',
        description: 'Learn words with flashcards, reading and grammar.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7f9',
        theme_color: '#005da7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { // Google Fonts stylesheet: use the cached one, refresh in the background
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          { // the font files themselves never change
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  base: './', // relative asset paths, so dist/ works from any folder or sub-path
  server: { port: 3000 }, // books/*.mjs and docs say http://localhost:3000
  preview: { port: 3000 },
  build: {
    /* CSS ships as written: the minifier drops fallbacks it thinks no browser
       needs (overflow-x: hidden before clip, -webkit-backface-visibility for the
       card flip on older Safari). Gzip makes the size difference small. */
    cssMinify: false,
    chunkSizeWarningLimit: 600, // the vendor file (React + Firebase) is ~550 kB and can't shrink
    rolldownOptions: {
      output: {
        /* React and Firebase in their own file: it changes only when a library is
           updated, so browsers keep it cached across app deploys. */
        codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] },
      },
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
