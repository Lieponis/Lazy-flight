import { defineConfig } from "vitest/config";

// base "./" makes the built site work under any address, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // Five pages are published: the game, the universe debug page, the model viewer, the game debug page and the planet looks preview.
      input: {
        main: "index.html",
        debug: "debug.html",
        models: "models.html",
        gamedebug: "game-debug.html",
        planets: "planets.html", // planet looks preview (Agent 7c)
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
