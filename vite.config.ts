import { defineConfig } from 'vitest/config';

// "base: './'" makes the built site work under any web address,
// including https://<your-name>.github.io/<repo-name>/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
