# Agent 5 brief, stage NAV-3: MY PLACES and FLIGHT PLAN screens

You are Agent 5 (UI). Work on the CURRENT `main`. Andy's problem: players cannot find their way back to outposts, the start dock or systems they liked. He chose MY PLACES, a NEXT HOP helper and a line on the map (Agent 3 draws the line). Logic comes from Agent 4 (`docs/nav-api.md`, his Step 1; start after it exists). Combat never. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), at most 5 steps; wording and layout options A/B/C. Saving usage matters: read only docs/status.md (last 40 lines), docs/nav-api.md, report-agent-5i.md section 2 (texts), report-agent-5j.md and the menu files you need. Report: docs/report-agent-5k.md (short).

## Do
1. **MY PLACES menu** (reachable from the main menu and from the map): rows grouped START / OUTPOSTS / RECENT / STARRED, each with the full name (never cut the code, use the existing helpers), distance in ly, and a badge like the job cards: READY TO FLY / REFUEL FIRST / TOO FAR FOR THIS SHIP (propose the wording). Tap a row: SET AS DESTINATION, SHOW ON MAP, STAR / UNSTAR. A star button on the planet card and the dock/docked view to star the current place (cap 30; friendly message when full).
2. **FLIGHT PLAN screen** for the chosen destination: summary (total ly, number of hops, total fuel, estimated refuel cost, the game's status `ok` / `too-far-no-docks` / `stuck` as a friendly sentence in the game's voice), then the list of the next hops (name, ly, refuel stop), and two buttons: FLY NEXT HOP (uses the existing free travel for the first hop, with the usual confirmation/strand rules) and SHOW ON MAP (asks Agent 3's camera function). Show "plan shows the next 20 hops of about N". Clear destination button.
3. All texts friendly and funny in the existing voice, child friendly, short; narrow phones (360 px) and long names (system 29, planet 34, dock 62 letters) must not overflow. Tests for text helpers; `npm run check` green; do not touch `src/render/flight.ts`.

## Allowed / not allowed
Allowed: `src/ui`, ui styles, ui tests, docs. Only the smallest glue edits in `src/ui/index.ts` shared with Agent 3 (pull often). Not allowed: `src/game`, `src/save`, `src/universe`, `src/render`, workflows, game numbers.

## Andy checks
Phone screenshots: MY PLACES with the three row types, a FLIGHT PLAN to a far target, FLY NEXT HOP working on a test save (Agent 4/5 give the link), and the star button.
