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

// The game's version: written in ONE place (package.json "version"), put into the code at build time (Agent 7d).
const appVersion: string = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
// The release page (about.html) shows it too: Vite replaces %VITE_APP_VERSION% in html files.
process.env.VITE_APP_VERSION = appVersion;

// base "./" makes the built site work under any address, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  define: { __PWA_ENABLED__: JSON.stringify(pwaMode === "on"), __APP_VERSION__: JSON.stringify(appVersion) },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // Six pages are published: the game, the universe debug page, the model viewer, the game debug page, the planet looks preview
      // and the release page (about.html).
      input: {
        main: "index.html",
        debug: "debug.html",
        models: "models.html",
        gamedebug: "game-debug.html",
        planets: "planets.html", // planet looks preview (Agent 7c)
        about: "about.html", // release page (Agent 7d), online only
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // The balance simulator and the full-loop game tests play many game hours; on a slow build machine they can
    // pass 5 seconds (the default) without anything being wrong. 30 seconds keeps speed from blocking a publish.
    testTimeout: 30_000,
  },
});
