# Agent 5 brief, stage G5b: screens and texts on universe v3

You are Agent 5 (UI / UX). Andy said "Go galaxy". Universe (G3) and game/save (G4) are done on branch `universe-v3` (never main). Work ONLY on branch `universe-v3`, on its CURRENT head, **after Agent 3 has pushed his Step 1 compile fix** (Andy tells you; Agent 3 works on render and the map at the same time). Nothing merges into main in this stage. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Visual work: options A/B/C and "matches / does not match". Explain technical words in one sentence. Combat never. Report: docs/report-agent-5i.md.

## Read first
docs/WHERE-TO-LOOK.md, docs/status.md, **docs/universe-v3-game-api.md**, docs/report-agent-4i.md (sections 1, 2, 4, 5, 6, 9), docs/report-agent-2e.md (sections 5, 7), docs/report-agent-5g.md, docs/report-agent-3i.md (name helpers).

## Do
1. **Job cards show reach.** `BoardEntry.reach` is `now` / `refuel` / `never` and `reachText` is a plain sentence. Show them clearly and funnily: can do now, needs fuel first, too far for this ship (greyed, cannot be accepted, say why). Sort or group sensibly (propose A/B/C to Andy). Rewards come from `job.reward`; never compute one in the UI.
2. **Board messages.** `getBoardSummary().message` (nothing doable now or ever) and `getPlaceInfo().remoteMessage` (far dock): show them on the board screen when `doNow + afterRefuel = 0`, in the game's friendly voice. No empty screen without a text.
3. **"Universe rebuilt" message** (shown once after an old save moves; `planStart(...).notice`) and the **save file import confirm text**: write the words (relaxed, child-friendly, short): what is kept (credits, ships, upgrades, paint jobs, ranks, counts, time), what is gone (job in progress, free trip, outposts are refunded, explored places), and where the ship is now (the start dock). Plain, no scary words.
4. **Names in the screens.** System names are now like "Bimvik Deep JR62R-MT37" (up to 29 letters), planets up to 34, dock full names up to 62. Check every menu, the HUD strip, job cards, free-trip list, explorer screen, install hints on a narrow phone. Never cut the code (use the existing helpers; one shortening rule, tell Andy if the menu version and the 3D version should be merged later, that is a suggestion). Show the code alone in tight places only if Andy likes it (suggestion from Agent 2).
5. **Free travel and Explorer lists** use `nearbySystems / nearbyDocks` by count: no list may grow to thousands of rows (cap and scroll, say how many you show). Explorer counts can be large now (cap 100,000 explored systems): numbers must not overflow a card.
6. **Tests:** fix `tests/ui.test.ts` (BoardEntry has `reach` and `reachText`; removed imports), `ui-savefile`, `ui-names` and any other ui test on the branch's failing list. `tests/agent6c.test.ts` counts literals in `src/render/flight.ts`: never touch that file. After your steps and Agent 3's, the old workflow "Check a branch" must be green; say what is still red if not.
7. **Phone check list** for Andy: narrow phone widths, the three board states (can do / needs fuel / too far), the far-dock message (use a developer link or a test save, tell Andy how), a moved old save.

## Report must contain
What was built; the exact texts (so Agent 6 can test them); the list of files touched; test status; known issues; suggestions labelled "suggestion".

## Allowed / not allowed
Allowed: `src/ui`, ui styles and html text, tests for ui, docs. Only the smallest edits in `src/ui/index.ts` outside your own areas; Agent 3 touches the glue lines for the map (merge carefully, pull often). Not allowed: `src/universe`, `src/game`, `src/save` logic, `src/render`, `src/audio`, existing workflows, anything that changes a decision above. If a text lives in game or save code, ask the Lead.

## Andy checks
1. The three board states on the start dock board (screenshot).
2. A far-dock board with the message (Agent 5 gives the link).
3. An old save moves: the message reads well, once.
