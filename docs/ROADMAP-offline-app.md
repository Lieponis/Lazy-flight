# ROADMAP: installable offline app (PWA), save file moving, offline test workflow

Status: APPROVED by Andy 2026-11-12 (installable offline app, save moving, offline test workflow). Lead owns this file.

## What we are building (plain words)
The same game, installable from the browser to the phone home screen (no app store, no fee). After the first visit it works with no internet. Progress can be moved between devices with a save file. A test workflow proves it never crashes and never shows "unreachable" messages when offline.

A PWA ("progressive web app") is a website that the phone may install like an app. A "service worker" is a small helper script that keeps a copy of the game's files on the phone and serves them when there is no network.

## Hard rules (Andy)
- Offline must never crash and never show a browser "site can't be reached" page once the game was loaded once.
- Saves must never be lost by an update. Same `lazy-freight.*` save keys, same `SAVE_VERSION` rules.
- Free flight is permanent as menu travel only; combat never. No new features outside this roadmap without Andy.
- Debug pages (/debug.html, /game-debug.html, /models.html, /planets.html) are NOT part of the installed app (kept online only, or cached lazily, Agent 1 decides and reports).

## Known facts and risks
1. iPhone: the installed app has its OWN storage; it does not see saves made in the Safari tab. That is why save moving (stage P2/P3) matters.
2. iPhone may clear stored data of a site not opened for a long time (an installed app is safer). Export is the insurance.
3. GitHub Pages serves the game from a sub-folder (/Lazy-flight/); manifest `start_url`/`scope` and service worker scope must match it.
4. Update danger: a cached old game + a new save format, or half-updated files, can crash the game. The update flow must be atomic (all files or none), and old saves must keep loading.
5. First visit must be online. If someone opens the app offline for the very first time, show a friendly game-styled message, never the browser error page.

## Stages (one at a time, each ends with a live build and Andy's check)

### P1 Installable + offline (Agent 1, infrastructure)
Brief: docs/briefs/agent-1b-brief.md (Lead writes after Andy says go).
- Manifest (name LAZY FLIGHT, short name, colours, display fullscreen/standalone, orientation any), correct scope/start_url for /Lazy-flight/.
- Icons (placeholder from the title planet/ship; real art in P5): 192, 512, maskable, Apple touch icon.
- Service worker that caches the whole built game (hashed Vite files) on first visit; cache-first for game files; versioned cache name from the build; old caches deleted on activate.
- Update flow: new version downloads in the background; applied only at a safe moment (next launch or a "New version ready, tap to refresh" note); never mid-flight; never breaks the save.
- Offline fallback: friendly in-game message if opened offline before any visit.
- Tests: pure helper tests; a build check that every file the game needs is in the cache list.
- Andy checks: install on iPhone (Share > Add to Home Screen), open, play; then airplane mode, open again.

### P2 Save file: export and import logic (Agent 6, saving; or Agent 4 if 6 is busy)
- File format: one JSON file `lazy-flight-save-YYYY-MM-DD.json` with: format version, game save (the whole `lazy-freight.save` content, current SAVE_VERSION and universeVersion), sound settings (`lazy-freight.sound`), seed, a checksum, app version, date.
- Import validates: file type, size limit, checksum, version. Garbage, wrong game or too-new version = refused with a plain message, nothing changed. Older versions go through the existing migrations (universe v1 to v2 move + refund, pre-F1, pre-4g, etc.). Always keep a backup of the current save before overwriting (one level of undo).
- Also a text version (copy/paste string) for phones where files are awkward.
- Tests: round trip; every old version imports through the WHOLE load path; corrupt files refused; backup/undo works; two imports in a row.

### P3 Save moving screens + install hint (Agent 5, UI)
- A "SAVE FILE" panel in the menu: EXPORT (download file + copy text), IMPORT (choose file / paste), confirm before overwrite showing what is in the file (credits, ships, rank), UNDO last import, plain error messages in the game's friendly tone.
- Install hint: small once-only note "Install me: Share > Add to Home Screen" (iPhone) / "Install" (Android), dismissible. Needs the stored "seen" flag (small save field with default, approved here).
- "You are offline" indicator is optional and only a tiny icon; the game must play identically offline.
- Options A/B/C for the panel look first; phone upright and sideways.

### P4 Offline test workflow (Agent 6, QA) — see "Test workflow" below
Builds the automated offline checks and gives Andy the one phone checklist. This is the QA Andy asked for; the general QA pass (brief 6d) stays optional.

### P5 Icon, name, splash, release page (Agent 7)
- Real app icon and splash from the game's own art, themed screenshots, "Install this game" on the release page (about.html on the same GitHub Pages site). Final publish and v1.0 label.

## Test workflow: offline without crashes or "unreachable" messages

Goal: prove four things: (1) first online visit caches everything, (2) every screen works offline, (3) updates never break saves or leave half a game, (4) no browser error page is ever shown.

### Automated (Agent 6, runs in the cloud and in Actions)
Headless browser (Playwright/Chromium) against the built game served from a local server under the same sub-path as GitHub Pages:
1. Load online once, wait for the service worker "ready".
2. Switch the browser context to OFFLINE. Reload. Expect: the game page loads, no console errors, no failed network requests for game files.
3. Play a scripted loop offline: new game, accept and deliver a job, free travel to a planet, Explorer arrival, buy a paint job, save, reload offline, state is the same.
4. Visit every screen offline (title, galaxy map, system view, docked, flight, floating, Jobs, Shipyard, Ranks, Save panel) at phone and desktop sizes. Fail on any console error, any request to the network, or any "can't be reached" page.
5. Update test: serve version A, load, go offline, serve version B online, come online, trigger update; check the game still runs, the save loads, no mixed files (A and B never mixed), old cache gone.
6. Old-save test through the whole path in the offline app (pre-F1, universe v1, pre-4g files).
7. First-visit-offline test: new browser profile, offline: the friendly in-game message appears (not the browser error).
8. Export/import test offline (it is local only): export, wipe storage, import, state identical.
9. Added as `npm run offline-check`; Actions runs it on every branch and on main. A failure blocks publishing.

### Manual (Andy, one short checklist from Agent 6, on the iPhone Air; Android if borrowed)
1. Safari: open the live link once, Share > Add to Home Screen.
2. Open the app from the home screen, play 1 minute (including sound after first tap).
3. Close it fully, turn on AIRPLANE MODE, open it again: it must start and play. Take a free trip, buy fuel.
4. Settings > SAVE FILE > EXPORT; move the file to another device or send to yourself; IMPORT there.
5. Turn airplane mode off, open the app: nothing breaks; if a new version exists you see the "New version ready" note.
6. Report anything weird in plain words; do not retry silently.

### Rules for every agent in this roadmap
- Never test only in an online tab; always also in a fresh profile and in offline mode.
- A failed offline check is a blocker, not a note.
- Report honestly what was NOT verified (real iPhone storage eviction, Android, low storage).

## Open questions for Andy (the Lead will ask before the relevant brief)
- App icon style (P5): from the title planet, the ship, or a new simple emblem? (options A/B/C then)
- Do you want the app name on the phone to be "Lazy Flight" (recommended)?
