# Agent 5 report, stage U3 UI (5e): wording and menus for fewer docks

## 1. What was built (src/ui, CSS, ui tests only)
- **Planet panel on the system map** (`src/ui/planetpanel.ts`; Andy chose layout A out of A/B/C). Tapping a planet shows a card:
  - A **dock** gets an amber tag "DOCK · OUTPOST" or "DOCK · STATION", the dock's name, "Planet · type · size", and one line: "Jobs and fuel here.", "...This outpost is for sale." or "Your outpost: cheaper fuel, better pay.". When you are docked there it also shows "YOU ARE HERE".
  - A **planet without a dock** gets a grey "SCENERY" tag, its name, type and size, and a funny line. The line is chosen from 6 by the planet id, so it is always the same for the same planet; for example "No dock. Great view, terrible parking.".
  - Before anything is tapped: "Tap a planet to see it. Drag to turn, pinch to zoom."
  - On an upright phone and on a computer, the card sits at the bottom above the map buttons. **On a sideways phone it sits on the left, under the system name** (Andy's request after his phone check).
  - It does not catch taps, so dragging the map still works.
  - It replaces the render layer's plain text label on the system map **without any render change**: the UI adds the body class `ui-planet-panel-on`, and `theme.css` hides `.hud-label` while it is set. On the galaxy map and docked view, the render label is back as before.
- **"Universe rebuilt" note** (Andy chose C, the fading note): reworded to "Universe rebuilt! Your credits and ships came along." plus "Your outposts were sold back for 40,000 CR." (credits now with commas). It stays 12 seconds (tap closes it) and now appears **after PLAY**, so the title screen can no longer hide it. Once per migration (src/save writes the moved save back).
- **Wording:** the empty Jobs board now says "No jobs on the board right now. New ones arrive soon - have a coffee.". I checked every UI text for "planet" meaning "dock": the menus already say dock / destination (Jobs cards "→ Dock · System", the status strip, Shipyard "ANY DOCK", outpost texts). Nothing else needed changing.
- **Tutorial hints:** there is no tutorial in the game yet, so nothing to update. The only hint lines (Refuel hint, map hint) are correct for the new universe.
- **Tests:** 7 new tests in `tests/ui.test.ts` (panel for scenery, station, outpost for sale, owned, here; the scenery line is stable; the new note text with refund; other notes unchanged; empty-board text). `npm run check`: 588 pass.

## 2. Verified
- GitHub Actions green: e3f2614, fc80466.
- Headless browser at 360×740, 740×360, 844×390, 390×844 and 1280×800: dock and scenery cards; the render label hidden only on the system map; the card on the left when sideways; a v1 save planted in storage shows the note after PLAY, with the refund, once, and not again after a reload; the page never scrolls.
- One-dock start systems (seeds 1, 4, 6, 7): the map shows 1 DOCK and the rest SCENERY. Jobs shows a full board of 6, all to other systems, with no empty list and no errors.
- Andy on his phone: dock and scenery planets; one-dock systems (`?seed=4`, `?seed=7`, in a private tab); the rebuilt note; upright and sideways (after the side move).

## 3. Known issues and notes for the Lead
- **Seed 1:** a new player can take 0 of the 6 jobs on the first board in the one-dock start system. This is the "dead first board" Agent 4 reported (rules or balance, U4), not a UI issue.
- The `.hud-label` hiding is a CSS link to a render class name. If Agent 3 renames `.hud-label`, the old label would show under the card. Suggestion: Agent 3 could later stop setting the label on the system map, and then the CSS rule can go.
- A `?seed=` address starts a fresh game and the autosave replaces the player's save. Andy used a private tab for the seed checks. Suggestion: warn about this in the README or debug notes.

## 4. Changes outside src/ui
`tests/ui.test.ts` and this report. Nothing in src/render, src/game, src/universe or src/save.

## 5. Suggestions (not built)
- A small "no dock" marker on scenery planets in the system view itself (needs src/render, Agent 3).
- A first tutorial hint pointing at JOBS for new players, when a tutorial stage is planned.
