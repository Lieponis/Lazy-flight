# Agent 6 report, stage P2 (6e): save file export and import (logic + debug buttons)

Live: https://lieponis.github.io/Lazy-flight/game-debug.html (section 10) · code on `main` · `npm run check`: 747 tests pass.

## 1. What was built
- **`src/save/transfer.ts`** (new), exported through `src/save/index.ts`:
  - `exportSaveFile(storage)` returns `{ ok, filename, json, text, summary, file }` from what is in storage now. It changes nothing.
  - `inspectImport(textOrJson, currentSeed?)` returns `{ ok: true, summary, warnings, file }` or `{ ok: false, reason }`. It changes nothing.
  - `applyImport(storage, textOrJson, currentSeed?)` returns `{ ok: true, summary, warnings, reloadNeeded: true }` or `{ ok: false, reason }`.
  - `undoImport(storage)` and `canUndoImport(storage)`.
  - Helpers: `saveFileName(date)`, `saveFileChecksum(file)`, `cleanSoundSettings(raw)`, plus the plain refusal and warning texts as constants (`REFUSE_*`, `WARN_*`) for Agent 5's screens.
- **`src/save/autosave.ts`**: the autosaver now stops for good when the save is replaced by an import or undo (new key `lazy-freight.save.generation`, explained below). Nothing else changed there.
- **`/game-debug.html` section 10, "Save file"**:
  - Export this test game: summary, the text, Download the file, Copy the text.
  - Export the REAL game's save (read only).
  - Import: a paste box, or choose a file. Check it (changes nothing), Import it, Undo the last import.
  - TEST: wipe this page's save.
  - All text is shown as text (never as HTML).
- **Tests:** `tests/save-transfer.test.ts`, 33 tests (747 in total).

## 2. The file
- **Name:** `lazy-flight-save-YYYY-MM-DD.json` (the player's local date).
- **Content (JSON):**
  - `format: "lazy-flight-save"` and `formatVersion: 1`
  - `appVersion: null`: the build has no version number yet. Suggestion for P5: add one in `vite.config.ts`, then fill it here.
  - `exportedAt` (ISO date)
  - `save`: exactly what `lazy-freight.save` holds, including `version` (SAVE_VERSION) and `universeVersion`
  - `sound`: the `lazy-freight.sound` settings, or null
  - `summary`: credits, ships, active ship, ranks, Explorer rank with systems and planets, outposts, extra paint jobs, trip under way, saved date, universe version
  - `checksum`: "cyrb53:" plus 14 hex digits
- **Text form for copy/paste:** `LFSAVE1:` + base64url of the same JSON. It uses only letters, digits, `-` and `_`: no spaces, no line breaks. Spaces or line breaks that a phone adds when pasting are ignored. A fresh game is about 1,500 characters; a big save with the full explored list is at most about 0.7 MB.
- **Checksum:** taken over the known fields, with keys sorted, so spacing and key order don't matter. It notices damaged or hand-edited files. It is **not** a security lock: anyone clever can recompute it, which is fine for a single-player game.
- **Size limit:** 3,000,000 characters for text or file. That's more than 4x the biggest possible save, and still small for a phone. The debug file chooser checks the file size before reading.
- **Privacy:** only game data goes in the file (a test checks there is no `@`, browser name or device text). Nothing in a file is ever run; it is only read as data.

## 3. What import checks (in this order; any refusal = storage untouched)
| check | refusal shown to the player |
|---|---|
| empty | "There is nothing to import. Paste the save text or choose a save file." |
| too big | "That is far too big to be a Lazy Flight save." |
| not JSON / not our format name / a bare save without the file wrapper | "That is not a Lazy Flight save file. Nothing was changed." |
| text form that does not decode, truncated text, wrong checksum, no checksum | "This save file is damaged or was edited, so it cannot be trusted. Nothing was changed." |
| file format, SAVE_VERSION or universe version newer than this game | "This save is from a newer version of the game. Update the game first, then import it." |
| the save fails the normal load path (shape check, universe move, repair, fit to the universe, load into a real Game) | "This save could not be loaded. Nothing was changed." |
| no storage (private window) | "Saving is off in this browser (private window?), so nothing can be imported here." |
| storage refuses to write | "The phone refused to store the save (storage full?). Nothing was changed." (the old save is put back) |

Warnings (import still allowed):
- an older universe ("will be moved: credits, ranks and ships come with you, outposts are paid back")
- a trip under way ("time away counts, so it may land as soon as the game starts")
- a different seed from the current game

The summary shown before an import is always **rebuilt from the save itself**. The file's own `summary` field is never trusted.

## 4. Apply, undo, and the running game
- **applyImport** first copies the current `lazy-freight.save` and `lazy-freight.sound` (exact text, or "was empty") into **`lazy-freight.save.beforeimport`**. It then writes the imported save, cleaned of unknown fields, and the sound settings if the file has them; otherwise the sound settings stay as they are. The save is stored as the file holds it. The NEXT page load sends it through the normal path, so the universe v1 → v2 move with refund and the "universe was rebuilt" message, pre-F1, pre-4g and every repair work exactly as for a save that was always on the phone.
- **reloadNeeded: true** means the screen must reload the page. That's the cleanest way to start from the imported state. The debug page reloads with `?seed=` set to the save's seed (it only loads saves of its own seed).
- **The old game in memory cannot overwrite the import.** Every import and undo changes `lazy-freight.save.generation`. Each running autosaver remembers the value it started with and stops writing for good when it changes. That covers a change in the old game, the page being hidden, the page closing during the reload, and another tab with the game open. Tests prove the import survives all of these, and that the next page load saves normally again.
- **Undo swaps:** the imported save goes into the undo slot, so pressing Undo again brings the import back. There's only one level: after two imports in a row, Undo gives the first import, not the save from before both. If the device had no save before the import, Undo goes back to "no save", and the next load is a new game.
- **A fresh export of the live state:** call the autosaver's `saveNow()` just before `exportSaveFile` (the debug page does). The autosave is normally already current anyway; it writes after every change and when the page is hidden, also mid-trip.

## 5. Tests (all through the whole start path)
Each import is followed by a full "page load": `planStart` → universe move → new `Game` → `loadIntoGame` → autosave. Then the board, ranks, Explorer, ship catalog, outposts and paint catalogs are read, so a broken field would throw.
- **Export:** the right name, text form, content equal to storage, no private data, works mid-trip, refusals when nothing is saved, and never moves a broken save.
- **Round trip** (text and JSON forms): identical state, including the explored list, paint jobs (worn and owned), three ships with fuel, upgrades, outposts with their prices, ranks and sound. A trip under way still lands and pays. A file without sound leaves the sound settings alone.
- **Old saves:** universe v1 (moved, outposts refunded from their stored prices, explored cleared, message shown); pre-F1; pre-4g; one missing nearly every newer field; very old fields with wrong types (repaired).
- **Refusals** (storage checked byte for byte unchanged): empty, spaces, garbage, another game's JSON, an array, a bare save, truncated JSON, truncated text, bad base64, hand-edited credits, missing checksum, huge, too-new format, save version and universe version (sealed with a correct checksum, as a newer game would), no storage, storage that refuses to write.
- **Backup/undo:** undo, redo, undo to empty, two imports in a row.
- **Autosave:** it cannot overwrite an import or an undo.
- **Odd files:** unknown extra fields dropped, pasted text with line breaks, a different-seed warning, a trip warning, nonsense sound values cleaned, no-dock save refused, script-looking text refused or treated as data.
- **Sound:** the save file's sound key, defaults and cleaning are equal to `src/audio/prefs.ts`.
- **Headless Chrome on the built site (`/game-debug.html`), no console errors:**
  - add credits → export (text and download) → wipe → refuse garbage → refuse an edited text (credits unchanged) → check good text → import (credits back) → undo → redo → wipe → import from the downloaded file
  - "Export the REAL game's save" after playing on the main page
  - the main game still saves and reloads mid-flight

## 6. Changes outside the brief, and why
- The brief allowed `src/audio/prefs.ts`. The layer rule test, however, forbids `src/save` from importing `src/audio`, and I kept that rule. So the save file reads and writes the `lazy-freight.sound` key itself, with a copy of the 10-line cleaning rule. A test checks that the key, defaults and cleaning stay equal to `src/audio/prefs.ts`. `src/audio` is unchanged.
- New storage keys (added, none changed): `lazy-freight.save.beforeimport` (undo slot) and `lazy-freight.save.generation` (autosave guard). `SAVE_KEY`, `SAVE_VERSION` and its meaning are unchanged.

## 7. Andy's checks (2026-11-12, /game-debug.html): ALL PASSED
1. Export: summary shown, text copied, file downloaded. OK.
2. Wipe, then import the text: 50,200 credits came back. OK.
3. Garbage and an edited text refused with the friendly messages, nothing lost; Undo brought the previous game back. OK.

## 7b. NOT verified
- Moving a save between the Safari tab and the installed iPhone app (that needs the P3 screens in the real game).
- Android, desktop Safari and Firefox.
- The iPhone "Files" app: how a downloaded `.json` file is picked again for import. P3 should test with the paste text first.
- The real game's own screens: those are P3 (Agent 5). Today only the debug page can import, and only into its own test game.

## 8. For the next agents
- **P3 (Agent 5):**
  - Call `saver.saveNow()`, then `exportSaveFile(getBrowserStorage())`. Offer `filename` + `json` as a download and `text` for copy.
  - For import: `inspectImport(text, currentSeed)` → show `summary` and `warnings` → confirm → `applyImport(...)` → when `reloadNeeded`, reload the page WITHOUT `?seed=` (the game reads the seed from the save).
  - `canUndoImport` / `undoImport` for the UNDO button.
  - Show all texts as text (`textContent`), never as HTML.
- **P4 (Agent 6):** add an offline export/import round trip to the offline check (it's local only).
- **Suggestion:** an app version number in the build, so `appVersion` can be filled and "newer version" messages can name it.
