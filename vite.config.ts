import { defineConfig } from "vitest/config";

// base "./" makes the built site work under any address, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // Three pages are published: the game, the universe debug page and the model viewer.
      input: {
        main: "index.html",
        debug: "debug.html",
        models: "models.html",
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
