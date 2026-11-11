# Agent 5 brief, stage F2b: screens for free travel, the Explorer rank and paint jobs

You are Agent 5 (UI/UX). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-free-travel.md (Andy's answers), docs/report-agent-4f.md (section 6), docs/report-agent-4g.md, docs/report-agent-3g.md (the render API and the 4 glue edits), docs/report-agent-5e.md, docs/report-agent-8-liveries.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first, then a "matches / does not match" list. Report: docs/report-agent-5f.md. Combat and weapons never; no steering of the ship.

## Goal
Everything the player needs to use free travel, the Explorer rank and paint jobs, in the existing screens, readable on a phone upright and sideways.

## Do
1. **Fly here button (free travel).** On the planet panel (system view): for any planet (dock or scenery), a button "Fly here (fuel N)" using `game.canFreeTravel(id)` for the numbers and the refusal text (plain text from the game, shown, never hidden); `game.freeTravel(id)` to start; then start the 3D trip with Agent 3's API (`api.startFlight`, planets without a dock allowed). Also reachable from the map (Galaxy map) for a star's docks if natural; keep it simple. Show "fuel left on arrival" before the player confirms. Jobs menu is unchanged.
2. **Floating at a planet** (no dock): `game.whyNotDocked()` gives the plain text; show a small calm panel with the planet name, the funny line, and what you CAN do (fly somewhere, switch ship, emergency refuel if stuck). Jobs, refuel and shop buttons show the game's refusal line instead of failing silently. Use `api.showFloating / floatingPlanetId / leaveFloating` per Agent 3's report. Make sure leaving a floating spot and reloading the page both end in a sane screen.
3. **Arrival line:** after a free arrival show `game.lastFreeArrival` (discovery credits, new system / new planet) as a short, friendly, fading note like the "universe rebuilt" one.
4. **Explorer rank row** next to the three job ranks: `game.getExplorer()` (systems, planets, discoveries, rank name "Lost in Space" / "Cartographer" / "Mr Galaxy-wide", next rank, discoveries to go). Rank-up note in the same style as the other ranks.
5. **Camera button:** replace Agent 3's placeholder icon (cycles Orbit, Free, Cockpit) with a proper pixel icon and a tiny label; works by touch.
6. **Paint jobs in the Shipyard:** a PAINT button on each owned ship card (or inside the card) opens a list from `game.getLiveryCatalog(shipId)`; name and description from `liveriesFor(shipId)` by `row.id`; a small preview of the ship in that paint (use the existing preview, `shippreview.ts` accepts a livery id); price (500, standard free) and BUY; after BUY offer "Wear now" (Agent 4's suggestion; buying does not put it on); WEAR for owned ones; `row.reason` as the refusal text. Wire the worn paint into the views: `api.setShip(id, livery)` with `game.currentLivery(shipId)` on every ship change, load and switch, so the docked view, flight and the preview all wear it.
7. **Sound for free trips:** `src/ui/sound.ts` copies the flight phase timing from render; free trips have phases about 1.6x longer, so sounds drift. Make the sounds follow (read the timing from the same constants if the layer rules allow, otherwise copy them, and keep the existing guard test that counts `launchSeconds:` in flight.ts passing). Do not change sounds themselves.
8. **Tutorial hints:** add short hints for free travel (when stuck or after first docking: "No jobs? Fly somewhere new, you earn credits for discoveries") and for Explorer. Keep the tone funny and relaxed.
9. Phone: nothing cut off, big buttons, page never scrolls. Tests for the plain text/logic helpers in `logic.ts` style; `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/ui (including sound.ts), CSS, ui tests, docs; the smallest glue in src/main.ts if needed (say exactly what). Not allowed: src/universe, src/game, src/save, src/render (ask the Lead if you need a render change), new features, anything Andy decided.

## Andy checks
On his phone (upright and sideways): tap a scenery planet, see "Fly here (fuel N)", fly there, see the floating scene and the discovery note, check the Explorer row, open the Shipyard, buy a paint job for 500 and wear it, see it on the docked ship and in flight. Try a refusal (not enough fuel / floating and trying to take a job). Camera button works by touch.
