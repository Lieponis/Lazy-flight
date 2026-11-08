import { defineConfig } from "vitest/config";

// base "./" makes the built site work under any address, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // Four pages are published: the game, the universe debug page, the model viewer and the game debug page.
      input: {
        main: "index.html",
        debug: "debug.html",
        models: "models.html",
        gamedebug: "game-debug.html",
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
