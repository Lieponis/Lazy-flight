import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { readMode } from "./scripts/pwa/lib.mjs";

// pwa-mode.txt: "on" (normal) or "retire" (kill switch for the offline app, see README).
let pwaMode = "on";
try {
  pwaMode = readMode(readFileSync("pwa-mode.txt", "utf8"));
} catch {
  /* no file = on */
}

// base "./" makes the built site work under any address, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  define: { __PWA_ENABLED__: JSON.stringify(pwaMode === "on") },
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
