# Agent 3 brief, stage NAV-2: the flight-plan line and place markers on the galaxy map

You are Agent 3 (Rendering). Work on the CURRENT `main`. Andy wants a **line track on the galaxy map that shows the hopping flight plan** to a destination (and markers for his places). The logic comes from Agent 4 (`docs/nav-api.md`, written in his Step 1; start after it exists). Combat never. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), at most 5 steps; visual options A/B/C and "matches / does not match". Saving usage matters: read only docs/status.md (last 40 lines), docs/nav-api.md, report-agent-3k.md (map section) and report-agent-3m.md. Render never imports game/ui/universe: data comes as plain arrays through the glue (`src/ui/index.ts` / `src/mapsource.ts`, smallest edits, list them). Report: docs/report-agent-3n.md (short).

## Do
1. **The plan line:** the plan is a list of hops (positions in ly). Draw a track from the ship through every hop in order: line segments plus a small marker at each hop (one style for refuel stops), a different marker for the final target. Pixel look, thin, bright, readable on the dense map and over the sky, never covering the tapped-star label. Parts beyond the zoom limit or the nearest-60,000 ball: the line must still leave the screen in the right direction, and the target shows as an edge marker with its name and distance in ly ("HOME, 1,240 ly"); say how you do it. Offer A/B/C looks (plain line, dashed line, line with moving dots) and let Andy pick.
2. **Place markers** (start dock, owned outposts, starred, recent): small distinct markers on the map when the star is inside the drawn ball; far ones as edge markers like the target. Only a few at a time; no label per marker except the selected one.
3. **Camera help:** one function the UI can call to "show the plan": frame the first hops (zoom-out limit respected).
4. **Phone speed:** the line and markers must not cost frame time; report FRAME at the start region with a 20-hop plan on Andy's iPhone (Safari `?mapstats=1`). Tests for the pure parts (edge marker maths, hop list to line points). `npm run check` green; do not touch `src/render/flight.ts` literals (`launchSeconds:` / `this.phases =`).

## Allowed / not allowed
Allowed: `src/render` (map files), the glue lines named above, render tests, docs. Not allowed: `src/universe`, `src/game`, `src/save`, `src/ui` (other than the glue lines), workflows.

## Andy checks
On his phone: A/B/C of the line, a plan to a far target from a test save (Agent 5/4 give the link), markers for start and outpost, the edge marker for a far target.
