import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths, so dist/ works from any folder or sub-path
  server: { port: 3000 }, // books/*.mjs and docs say http://localhost:3000
  preview: { port: 3000 },
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
