# Agent 5 brief, stage P3: SAVE FILE screens and install hint

You are Agent 5 (UI/UX). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/ROADMAP-offline-app.md (source of truth), docs/report-agent-6e.md (section 8 is your API: call order matters), docs/report-agent-1b.md (section 5: install detection, update note), docs/report-agent-5f.md, docs/report-agent-4g.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first, then a "matches / does not match" list. Explain technical words in one sentence. Report: docs/report-agent-5g.md. Combat never; no new game features.

## Goal
The player can move their progress between devices (for example from the Safari tab to the installed iPhone app, or to a new phone) and keep a backup, entirely from the game's menus, by file or by copy and paste. A once-only hint explains how to install the game.

## Do
1. **SAVE FILE panel** in the menu (where fits best; show Andy where in the options step). Works on a phone upright and sideways and on desktop, page never scrolls, big buttons.
   - **EXPORT:** call `saver.saveNow()` first, then `exportSaveFile(getBrowserStorage())`. Buttons: SAVE FILE (download `filename` with `json`; on iPhone Safari the download/share may behave differently: test and tell Andy what happens) and COPY TEXT (copy `text` to the clipboard, with a fallback: a read-only text box the player can select if the clipboard is blocked). Show the `summary` (credits, ships, rank, explorer discoveries) so he knows what is in the file.
   - **IMPORT:** choose a file or paste text. Call `inspectImport(text, currentSeed)` and show the `summary` and any `warnings` (different seed, trip in progress...) in plain friendly text, then a clear CONFIRM / CANCEL. On CONFIRM call `applyImport(...)`; when `reloadNeeded`, reload the page WITHOUT `?seed=` as the report says. Refusals show `reason` as given, nothing changes, and the player can try again.
   - **UNDO last import:** shown only when `canUndoImport`; asks to confirm; uses `undoImport`; then reload as needed.
   - Show every text with `textContent`, never as HTML. Funny/friendly tone like the rest of the game, but clear: this is the one place where mistakes cost progress. A big confirmation before overwriting.
2. **Install hint:** a small, once-only, dismissible note for players who are NOT yet running the installed app: iPhone Safari "To play offline: tap Share, then Add to Home Screen"; Android Chrome "tap Install" (use the browser's install prompt event if available); desktop: no hint. Detect the installed app with `matchMedia("(display-mode: standalone)")` or `navigator.standalone`. Never shown during a trip or flight, never again after dismissing. The "seen" flag is approved by Andy as one small save field with a default (name it e.g. `installHintSeen`; Agent 6e's import/export format must carry it or deliberately not: check with `exportSaveFile`/normalize, add it to the save normalizer in `src/save` in the smallest way, a test, and say exactly what you touched; this is the only allowed edit outside src/ui, besides what is already approved). If the standalone app is detected, also show a one-time tip: "Your progress from the browser is not here. Use SAVE FILE > IMPORT to bring it over." (once only, same flag mechanism or a second flag).
3. **Update note** (`src/ui/updatenote.ts`, Agent 1's): restyle only if it looks off next to the new panel; keep the safe-moment rule and `SKIP_WAITING`.
4. Tutorial hint (one short line) about SAVE FILE for new players is fine if it fits the existing hints system; do not add more than that.
5. Tests for the plain-text/logic helpers (summary text, warnings text, which buttons show when); `npm run check` green; Actions green. Andy tests on his iPhone upright and sideways AND on the installed app.

## Allowed / not allowed
Allowed: src/ui, CSS, ui tests, the one small save field in src/save (with its test), docs. Not allowed: src/universe, src/game, src/render, the service worker files, changing the existing save keys or the export format (Agent 6e's; if you need a change, ask the Lead), new features.

## Andy checks
1. In the Safari tab: open the SAVE FILE panel, export (file and text).
2. Open the installed app (it starts a NEW game): import the text or file; see the summary and confirm; the game reloads with your credits, ships, rank.
3. Try garbage text: refused, nothing lost. Try undo.
4. See the install hint once in a Safari tab (use a private tab), dismiss it, never see it again.
