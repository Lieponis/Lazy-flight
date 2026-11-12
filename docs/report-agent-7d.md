# Report: Agent 7, stage P5 (7d): app icon, version number, release page, v1.0.0

**Status:** BUILT and PUBLISHED as **v1.0.0** on 2026-11-12. Actions green; `npm run check`: 797 tests pass.
**Andy's phone checks are pending** (list in section 6).
Live: https://lieponis.github.io/Lazy-flight/ · release page https://lieponis.github.io/Lazy-flight/about.html
Commits on `main`: `ab9fd40` (icon, version; started earlier, paused while 7f ran, then brought back) and `ee31ec7` (release page, README, credits, tests).

## 1. App icon (Andy chose A, "ringed planet")
- Three looks were shown, each big, as a round Android icon and at real home-screen size: **A** ringed planet, **B** Scout over a planet, **C** "LF" emblem. Andy picked **A**.
- The icon is drawn pixel by pixel by code:
  - `scripts/pwa/icon-art.mjs` holds the pictures (A/B/C) in the game's colours: title navy, twinkling stars, sea, land, ice cap, and rock-tone ring.
  - `scripts/pwa/make-icons.mjs` (Agent 1's PNG writer) chooses `ICON_STYLE` (default A); `OUT_DIR` writes elsewhere for previews.
  - It produces the same four files as before (192, 512, maskable 512, Apple 180), so `manifest.webmanifest` is unchanged.
- **Maskable:** the planet and ring stay inside the middle 80 % (tested), and only stars reach the corners.
- **iPhone caches home-screen icons:** to see the new icon, remove the app from the home screen and add it again.

## 2. Version number
- **One place:** `package.json` `"version": "1.0.0"`. The description is also renamed to Lazy Flight.
- **Build time:** `vite.config.ts` reads it and defines `__APP_VERSION__` (for code) and `process.env.VITE_APP_VERSION` (Vite replaces `%VITE_APP_VERSION%` in html files).
- **Title screen:** small `v1.0.0` in the bottom-right corner (`src/ui/title.ts` `VERSION_TEXT`, style `.ui-title-version`).
- **Save files:** `appVersion` is now filled: `src/save/transfer.ts` `APP_VERSION`, one constant and one line. Test added to `tests/save-transfer.test.ts`. The format is unchanged: the field already existed and was `null`.
- **Offline cache:** its version is still the hash of the kept files. A new version number changes the game's code once, so there is one update; a rebuild with no changes still gives no update.

## 3. Release page `about.html`
- **Contents** (game pixel style, the game's own VT323 font file, no scripts):
  - pitch in the game's calm, funny tone, with a big PLAY button to the game;
  - **6 screenshots** taken with headless Chromium from the real build: title, Earth-like outpost, warp, ringed planets wall, system map, paint job. Saved in `public/about/` with 96 colours, 14–35 kB each, 148 kB in total;
  - how to play: jobs, fuel and emergency fuel, free travel and discovery, Explorer rank, ranks, ships, paint jobs, outposts, sound;
  - **install** steps for iPhone, Android and computer, and how updates work;
  - **move your save** (SAVE FILE export / import / undo);
  - what's in 1.0.0;
  - no credits section (Andy chose B, 2026-11-12): instead, one small line at the bottom, "Uses three.js (MIT) and the VT323 font (OFL) · licences", linking to `licenses.txt`. That file is published with the site and holds both full licence texts, which the licences ask to travel with the code and the font. Before this, the built site contained neither text.
- **No external requests** (checked in a browser: zero requests to other sites; tested in code). Child-friendly, no weapons.
- **Offline app:** `about.html` is **online only**. It is in `DEV_PAGES` in `scripts/pwa/lib.mjs`, so its css and images are never kept offline; offline it shows the friendly page. The build log lists it under "online-only".
- **Not linked from inside the game** (the brief said: only if tiny and Andy agrees; not asked yet). Its web address is in the README.
- **Not done:** the floating-scene and cockpit screenshots (the warp shot was used instead); a "splash" image beyond the icon (the installed app uses the manifest colours).

## 4. Files
`public/icons/*` (4 PNGs), `scripts/pwa/icon-art.mjs` (new), `scripts/pwa/make-icons.mjs`, `scripts/pwa/lib.mjs` (one list entry), `package.json` (version, description), `vite.config.ts` (define, env, input), `src/ui/title.ts` + `src/ui/theme.css` (version text), `src/save/transfer.ts` (appVersion), `about.html`, `src/about.css`, `public/about/*.png`, `public/licenses.txt`, `README.md` (top section), `docs/CREDITS.md`.
Tests: `tests/release.test.ts` (new, 9), `tests/save-transfer.test.ts` (+1 check).

## 5. Known issues and NOT verified
- **Not verified:**
  - the new icon on a real iPhone home screen (needs remove and re-add);
  - the "NEW VERSION READY" note in the installed app after this publish;
  - the release page on a real phone (checked in a test browser at phone and desktop size);
  - Android install.
- The leftover side branch `p5-icon-version-wip` on GitHub is **already merged**; my session could not delete it (403). Andy: GitHub → Branches → trash icon.
- The commit `ab9fd40` says "WIP (paused)" in its title; its content is final and was finished by `ee31ec7`.

## 6. Andy checks (pending)
1. iPhone: delete the Lazy Flight app from the home screen, open the game in Safari, Share → Add to Home Screen. Is the new ringed-planet icon there?
2. Open the installed app: title shows `v1.0.0` bottom right; play a little.
3. Open https://lieponis.github.io/Lazy-flight/about.html on the phone and on a computer: does it read well, do PLAY and the screenshots work?
4. (If an older installed copy is still around on another device:) open it: the "NEW VERSION READY" note should appear when docked.

## 7. For the Lead
- v1.0.0 is published. Next releases: bump `package.json` `version` (1.0.1 for fixes, 1.1.0 for content) and add a line to "What's in version" on `about.html`.
- **Open decision for Andy:** a tiny "ABOUT" link from the game (for example in MENU → SETTINGS) to `about.html`. Not built.
- **Also from Andy (7f):** the outpost landing plate should be land-coloured on Earth-likes (Agent 8 area; details in report-agent-7f.md section 6).
