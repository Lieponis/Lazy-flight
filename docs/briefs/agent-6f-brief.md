# Agent 6 brief, stage P4: offline test workflow (`npm run offline-check`)

You are Agent 6 (Save / QA / Balance). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/ROADMAP-offline-app.md (section "Test workflow" is your spec; test 7 was corrected), docs/report-agent-1b.md (sections 2, 4, 5), docs/report-agent-6e.md, docs/report-agent-5g.md, README.md section 4b. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Report: docs/report-agent-6f.md. Combat never; no new features. The general QA brief (6d) stays SKIPPED by Andy: do only this.

## Goal
Prove, automatically on every build, that the installed/offline game never crashes and never shows a browser "can't be reached" page; that updates never mix versions or break saves; and that save export/import works offline. Failures block publishing.

## Do
1. **Harness** (`tests/offline/` or `scripts/offline/`, your choice; keep Playwright out of the normal fast `npm test` if it needs a browser, but wire `npm run offline-check` into `npm run check` or into the workflows if the browser is available there; if Chromium cannot run in Actions, say so and give the best alternative): build the REAL game, serve `dist` under `/Lazy-flight/` exactly like GitHub Pages (a small static server), drive headless Chromium.
2. Implement the roadmap's tests 1-9 against the REAL built game (Agent 1 only tested a stand-in):
   1. First online load: service worker ready, one complete cache box.
   2. Offline reload: game loads, no console errors, no failed requests for game files, no request to the network at all.
   3. Scripted offline loop: new game, accept and deliver a job, free trip to a scenery planet (Explorer arrival), buy a paint job, reload offline: state identical. Use `?speed=` or the TESTER speed so it runs fast.
   4. Every screen offline at phone (upright and sideways sizes) and desktop: title, galaxy map, system view, docked, flight, floating, Jobs, Shipyard, Ranks, SAVE FILE panel, SETTINGS. Fail on any console error, any network request, any browser error page.
   5. Update test: serve build A, load, go offline, serve build B (change a file), come online, check the update note appears at a safe moment, REFRESH switches, versions never mixed, the old box is gone, the save still loads.
   6. Old-save test in the offline app: saves from universe v1, pre-F1, pre-4g, pre-import load through the whole path.
   7. Stored-copy-wiped test: load online, delete the cached files, go offline, open: the friendly in-game page appears (not the browser error). Developer pages offline show the friendly page too.
   8. Export/import offline: export, wipe storage, import, identical state; undo works; garbage refused.
   9. `npm run offline-check` runs all of it; prints a short plain summary; non-zero exit on any failure.
3. **Kill switch test:** build with `pwa-mode.txt` = retire (in a temp copy, do not change the real file), verify the retiring worker clears boxes and unregisters.
4. **Real-device checklist for Andy** (ONE short list, plain words): install from Safari, play a minute, airplane mode, open, take a free trip, export, turn airplane mode off, check the "NEW VERSION READY" note after the next publish, listen once to the sounds on a free trip (Agent 5f said sounds were checked in code only). Android only if a phone is borrowed.
5. Report honestly what the tests cannot prove (real iPhone storage cleanup, low storage, Safari-specific behaviour, Android). Add the new command to README (plain language) and to docs/WHERE-TO-LOOK.md.
6. Fix real bugs you find only if small and clearly yours (tests, scripts); for bugs in other layers write them up for the Lead with exact steps. Never weaken a check to pass.

## Allowed / not allowed
Allowed: tests, scripts, package.json scripts, workflows (tell the Lead exactly what and why), README, docs. Not allowed: changing game, UI, render, universe or save code (report instead), new features.

## Andy checks
Reads your short summary of what passed; runs the phone checklist once. If anything fails on the phone, tell the Lead in plain words.
