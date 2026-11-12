# Agent 5 report, stage P3 (5g): SAVE FILE panel, install hint, tester speed

## 1. What was built
Andy chose each look from A/B/C first: panel A, confirm A, hint A, and the speeds 1x/10x/20x/60x/300x/1000x.
- **SAVE FILE panel** (`src/ui/savefile.ts`, opened from MENU, Andy chose A: one screen):
  - **YOUR GAME NOW** summary.
  - **EXPORT**: SAVE FILE (the phone's share sheet when `navigator.canShare({files})` says yes, otherwise a normal download) and COPY TEXT (clipboard, or a read-only, pre-selected text box when copying is blocked).
  - **IMPORT**: CHOOSE FILE (`.json`, `.txt`) or PASTE TEXT, then CHECK THIS TEXT.
  - **UNDO LAST IMPORT** (only when `canUndoImport`, confirms first, then reloads).
  - Import flow: `inspectImport`, then a **side-by-side confirm** (Andy chose A: THIS FILE vs NOW, warnings in amber, a red "This replaces the game on this device…" line, REPLACE MY GAME / CANCEL), then `applyImport`, then reload **without `?seed=`**.
  - Refusals show the exact `src/save` text in red; nothing changes.
  - All texts use `textContent`, never HTML. A one-line tip under the SAVE FILE button: "New phone? SAVE FILE takes your game along."
- **Paste repair (found on Andy's iPhone):** the iPhone keyboard turned `LFSAVE1:` into `lfsave1:`, so `src/save` refused it. Now:
  - the paste box sets `autocapitalize`, `autocorrect` and `autocomplete` off and `spellcheck=false`;
  - `repairPastedText()` turns the start back into `LFSAVE1:` and removes spaces and line breaks, for the one-line text form only (JSON is left untouched).
  The checksum still refuses real damage. A test with a real export covers broken → refused, repaired → accepted, damaged → refused.
- **Install hint** (`src/ui/installhint.ts`, Andy chose A: a small card above the dock's name label, with ✕):
  - Shows once per device: iPhone/iPad Safari "PLAY OFFLINE: tap Share, then Add to Home Screen."; Android "install" with an INSTALL button when Chrome offers `beforeinstallprompt`. Never on a computer.
  - In the installed app (`display-mode: standalone` or `navigator.standalone`) it shows instead, once: "Your progress from the browser is not here. Use MENU > SAVE FILE > IMPORT…".
  - Only at a safe moment: docked, no menu, no trip.
  - **"Seen" flags:** I chose their own slot, `lazy-freight.hints`, NOT a save field. Each device should show its own hints once, the flag must not travel with an exported save, and `src/save` needed no change. This deliberately leaves it out of the import/export format.
- **TESTER speed** (MENU → SETTINGS → TESTER, Andy's six speeds): stored under `lazy-freight.testspeed` (not in the save, not exported), with an amber "for testing only" warning, a status line and RELOAD NOW.
  - **The one change outside src/ui:** `src/game/clock.ts` gained `startSpeed(search, stored)`. `?speed=` in the address still wins, junk is ignored, and the value is capped like `?speed=`. The UI glue uses it instead of `parseSpeedParam`.
- MENU and SETTINGS now scroll inside on short screens. The update note (6e) already matches the style and was left as it is.
- **Tests:** a new `tests/ui-savefile.test.ts` with 14 tests (summary and compare text, warnings, paste repair including a real export, hint rules and device detection, tester labels and status, `startSpeed`). Total: 761 pass.

## 2. Verified
- `npm run check`: 761 pass. Actions green: a3c6c27, 1dc661e.
- Two separate headless browsers at 390×844 and 844×390, one standing in for the Safari tab and one for the installed app:
  - the hint shows, and is gone after ✕ and a reload; the app tip shows in the "installed" browser;
  - export download named `lazy-flight-save-2026-11-12.json`; the COPY TEXT fallback box;
  - garbage refused; import of 48,200 CR works; undo puts back 200 CR;
  - 60x from TESTER is used after a reload, and a fast trip continues correctly across a reload;
  - the page never scrolls.
- Andy on his iPhone:
  - export from Safari (file and text) and import of the FILE into the installed app ("worked as intended");
  - garbage refused; undo twice (swaps back and forth);
  - tester 60x with the app closed mid-trip, then back to 1x;
  - the install hint once (private tab);
  - upright and sideways.

## 3. Known issues and notes
- Android's install button and Chrome's `beforeinstallprompt` were not tested on a real Android phone.
- Andy confirmed the share-sheet export ("worked as described"); the exact share-sheet choices on other iOS versions are untested.
- The hint and tester slots are per device and per storage (Safari tab and installed app are separate on iPhone, as expected).
- Undo is one level (src/save's design): the second undo swaps back.

## 4. Changes outside src/ui
`src/game/clock.ts` (`startSpeed`, about 10 lines, as the brief allows), `tests/ui-savefile.test.ts`, and this report. Nothing in src/render, src/save or src/universe.

## 5. Suggestions (not built)
- A "last backup made on …" line in SAVE FILE, with a gentle reminder after many play hours.
- QR-code transfer between phones (no server needed), if the text form proves awkward.
