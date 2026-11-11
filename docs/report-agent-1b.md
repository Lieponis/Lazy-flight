# Agent 1b report: stage P1, installable offline app (PWA)

Date: 2026-11-12. Branch `p1-offline-app`, merged to `main` (fast-forward) after a green check and Andy's OK. Brief: `docs/briefs/agent-1b-brief.md`. Plan: `docs/ROADMAP-offline-app.md`.

## 1. What was built

- **Manifest** `public/manifest.webmanifest`: name LAZY FLIGHT, short name Lazy Flight, `display: standalone`, `orientation: any`, colours #05060d, `start_url` and `scope` both `./` (relative to the manifest, so it fits `/Lazy-flight/` on GitHub Pages).
- **iPhone tags** in `index.html` only: manifest link, apple-touch-icon, apple-mobile-web-app-capable, status bar style `black`, title "Lazy Flight".
- **Placeholder icons** `public/icons/`: 192, 512, maskable 512, Apple 180 (pixel planet with a ring). Drawn by code: `node scripts/pwa/make-icons.mjs`. To use real art (stage P5) replace those four PNG files, same names and sizes.
- **Offline page** `public/offline.html` (game-styled, no outside files). A copy is also built INTO `sw.js`, so it still shows if the phone wipes the stored files.
- **Service worker** `dist/sw.js`, made at build time from `scripts/pwa/sw.template.js` by `scripts/pwa/postbuild.mjs` (runs at the end of `npm run build`):
  - The list of kept files is computed from the built site (no hand-kept list). The build STOPS if a file is imported but missing, or if a file is in the site that neither the game nor a developer page uses.
  - Every kept file has a SHA-256 fingerprint in the list. The worker downloads each file fresh (`cache: "reload"`), checks the fingerprint, and keeps the new box only if ALL files are present and correct. Otherwise it deletes the box. This is what makes "old and new files never mixed" true by construction.
  - Cache name `lazy-flight-<version>`; version = hash of all kept files plus the worker's own code (a rebuild with no changes does not trigger an update).
  - Cache-first for kept files; the game page is served from the box for the folder address and `index.html`, ignoring `?seed=`, `?speed=` and other options. Other sites and non-GET requests are never touched.
  - **Update flow:** a new version downloads into a NEW box; the old one keeps serving. No automatic `skipWaiting`. The switch happens at the next full launch, or when the player taps REFRESH (page sends `SKIP_WAITING`, then reloads on `controllerchange`). Old boxes are deleted only at activation, after the new box is verified complete (if the new box vanished and the network is down, old boxes are kept).
  - Developer pages (`debug.html`, `game-debug.html`, `models.html`, `planets.html`): not kept. A service worker cannot exclude sibling pages from its folder scope, so they are technically "in scope", but the worker passes them straight to the network (online: normal; offline: the friendly page instead of the browser error). Their own files are not in the list. Chunks shared with the game (e.g. Three.js) are kept because the game needs them.
  - No analytics, no calls to other sites.
- **Page glue** `src/ui/updatenote.ts` (new, the only file that mentions `serviceWorker`): registers `./sw.js` (production and https/localhost only, after `load`, `updateViaCache: "none"`), checks for a new version when the app returns to the foreground, and shows the "NEW VERSION READY / REFRESH / LATER" note. The note shows only when no job, no free trip and not on the `flight` screen (the rule is passed in from `src/main.ts`). It does not use the `.ui-notice` class (so the sound code does not "bonk") and uses no browser storage.
- **Kill switch:** `pwa-mode.txt` (`on` / `retire`). With `retire` the build publishes `scripts/pwa/sw-kill.js` as `sw.js` (deletes `lazy-flight-*` boxes, unregisters, reloads open pages from the network, serves nothing) and the page code only unregisters leftovers (no registration loop). Steps for Andy are in the README ("4b", plain language).
- **README** section "4b. Install it as an offline app" (iPhone, Android, computer, how offline works, updating, removing, kill switch) plus a line for agents in section 6.
- **Tests** `tests/pwa.test.ts`: 31 new tests (build check, version naming, the worker run inside a pretend browser: install all-or-nothing, activate, serving, update A to B, kill switch, note rule, manifest, icon sizes, page tags, "only updatenote.ts touches the worker").

Files touched outside new ones: `index.html` (head tags), `vite.config.ts` (reads `pwa-mode.txt` for a build flag), `package.json` (`build` now ends with `node scripts/pwa/postbuild.mjs`), `src/main.ts` (one import, `const game =`, one call), `README.md`. NOT touched: `src/universe`, `src/game`, `src/save`, `src/render`, other `src/ui` files, save keys, workflows, `docs/status.md`.

## 2. How it was checked

- GitHub Actions on the branch: types, build, **714 tests passed** (683 before + 31). Same on `main` (build and deploy green). The real build log lists 15 files kept and 8 developer files online-only.
- Kill switch build, run once on a temporary branch: the build wrote the kill-switch `sw.js` ("RETIRE") in real Vite output. That run also exposed a mistake of mine (a test that demanded `on`, which would have BLOCKED publishing the kill switch); fixed so both words keep publishing.
- Headless Chromium (Playwright) against a stand-in site built with the REAL `updatenote.ts`, the REAL `postbuild.mjs` and the real icons: 19 of 19 checks passed (first visit stores one complete box; offline reload; `?seed=`/`?speed=` offline; developer page offline shows the friendly page; browser-offline reload never asks the server; update v1 to v2 downloads in background, old version keeps running, note hidden during a trip and shown at a safe moment, REFRESH switches, old box gone, v2 works offline; kill switch unregisters, clears boxes, retired build loads from the network and does not register again). The script is not in the repository (stage P4 builds the proper suite).
- Andy, live (2026-11-12): normal tab unchanged and save intact; installed on his iPhone from Safari (icon and name fine, full screen); airplane mode: starts and plays; back online: all fine.

## 3. Live link

https://lieponis.github.io/Lazy-flight/ (Safari: Share, Add to Home Screen). Manifest: `/manifest.webmanifest`.

## 4. Known issues and what is NOT verified

- **Not verified:** Android, desktop install, real iPhone storage clean-up of an unused app, the "NEW VERSION READY" note on a real device (only in the headless stand-in; ask Andy to check it after the next publish, as the brief says), the kill switch on a real phone, the headless browser run on the REAL built game (only the stand-in; the full suite is P4), low-storage behaviour, sound after install by ear beyond Andy's "fine".
- A very first visit made offline cannot show the friendly message: nothing exists yet on the phone to show it. The friendly page covers the stored copy being wiped, and developer pages offline. (The roadmap sentence about "first visit offline" cannot be met literally; P4 test 7 should be adjusted.)
- The installed iPhone app has its own storage and starts as a NEW game until save moving (P2/P3).
- Temporary branch `p1-retire-test` is still on GitHub (my token cannot delete branches). It only runs checks and never publishes. Delete it in GitHub (Code > Branches > trash icon). Never merge it.
- `clients.claim()` runs on activate, so the first visit's page is controlled right away. A tapped REFRESH relies on `controllerchange`; a 4-second fallback reloads anyway.
- A shallow clone made the stop-hook think commits were unpushed; they were pushed.

## 5. Notes for the next agents

- **P2 (export/import):** nothing in P1 reads or writes saves. The worker never touches localStorage. Keep keys `lazy-freight.*`.
- **P3 (UI):** the install hint can detect an installed app with `window.matchMedia("(display-mode: standalone)").matches` or `navigator.standalone` (iOS). The "seen" flag is yours. The update note lives in `src/ui/updatenote.ts` (inline style, own class `lf-update`); restyle freely, but keep the safe-moment rule and the `SKIP_WAITING` message.
- **P4 (tests):** `npm run build` writes `dist/sw.js`; the file list and fingerprints are printed in the build log. The worker version is in the box name `lazy-flight-<12 hex>`. A good stand-in for update tests: build two versions, serve each under `/Lazy-flight/`, call `registration.update()`. My pretend-browser unit tests (`tests/pwa.test.ts`) show how to drive the worker events without a browser.
- **P5:** replace the four PNGs in `public/icons/`; keep `manifest.webmanifest` sizes in step (a test checks sizes). `about.html` on the same site would need adding to `planPrecache` rules only if the game should keep it offline; otherwise it is simply unknown and the build will tell you.
- Any new file that the game loads at runtime without importing it (for example a sound file fetched by name) will make the build stop with "neither the game nor a developer page uses it": add a reference or extend `lib.mjs`.
- Never run the kill switch and a normal build from the same commit: `pwa-mode.txt` decides.

## 6. Suggestions (not built, not approved)

- Trips are long for testing on a phone (about 1 minute per light year). A "test speed" toggle in SETTINGS (not an address option) would let Andy speed up the installed app. Needs the Lead and Andy.
- Show "offline" as a tiny icon (optional in the roadmap, not built).
- Add a Node 24 note to the workflows (GitHub warns that Node 20 actions are being forced to Node 24). Not urgent.
- Remove old unused branches on GitHub to keep the list short.
