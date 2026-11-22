import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths, so dist/ works from any folder or sub-path
  server: { port: 3000 }, // books/*.mjs and docs say http://localhost:3000
  preview: { port: 3000 },
  build: {
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
