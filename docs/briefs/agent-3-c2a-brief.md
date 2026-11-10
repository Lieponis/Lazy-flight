# Agent 3 brief, stage C2a: the new cockpit in the flight view

You are Agent 3 (rendering). Work on the CURRENT `main` of the repo (never an old zip). Read first: docs/cockpit-design-brief.md, docs/INTEGRATION-cockpit.md (Agent 8's technical notes, Part 1 is your recipe), docs/report-agent-8-c1.md, docs/report-agent-3d.md, docs/ROADMAP-cockpit.md, docs/CONVENTIONS.md, docs/status.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-3-c2a.md. Free flight and combat are permanently out: the cockpit is a view only.

## Goal
In flight, "Cockpit view" shows Agent 8's new base cockpit (the room Andy approved), seen through the cockpit lens, instead of the old flat overlay.

## Decisions already made by Andy / the Lead
- ONE base cockpit for all three ships for now. Per-ship cockpits, the sleeping dog, the warm lamp and the window light are DEFERRED (Andy). Do not build them.
- Import `buildCockpitBase()` directly from `src/render/assets/cockpitBase.ts`. It stays OUT of the asset registry on purpose (its window-light rule is deferred). Do not edit anything in `src/render/assets` (Agent 8's files, including lens.ts); if you need a change there, ask the Lead.
- View: 70 degrees side to side through the light Panini lens (`CockpitLens`, `COCKPIT_FOV`, `COCKPIT_LENS` in lens.ts). Andy chose this look.
- The HTML trip read-out (destination, countdown, phase, progress bar) STAYS exactly as it is in this stage. It moves into the cockpit screens in stage C2b.
- The throttle-lever animation is only a SUGGESTION: do not build it.

## Do (recipe in INTEGRATION-cockpit.md, Part 1)
1. Build the cockpit once in `FlightScreen`, keep it in a holder group (`cockpitRig`) in the scene. Not a child of the camera (it must not tilt or shake with the view).
2. Cockpit mode: place `cockpitRig` at the camera's eye spot before the pitch and the shake are added; hide it in Orbit mode.
3. Cockpit mode renders through the lens: give the `Screen` interface an optional `render(renderer)`; `index.ts` calls it when present, else the normal render. Orbit mode renders as today. Camera `near` stays 0.05 in cockpit mode. Dispose the lens and the cockpit's geometry/material when the flight screen is thrown away (no leaks over many flights).
4. Every frame call `model.update(clockT)` (it flashes the ~90 lights; cheap).
5. Hide the old overlay in cockpit mode. Keep `src/render/cockpit.ts` in the repo until Andy approves the new view, then remove it in a follow-up (tell Andy it is waiting).
6. Make sure the stars, planet and warp tunnel are visible through the window, that your own ship's model never shows (the player's ship is not drawn in cockpit view), and that Orbit view and every other screen are unchanged.
7. Works with every ship id (`?ship=scout`, `?ship=passenger-liner`) and with window shapes: desktop, phone upright, phone sideways. No stretched edges.
8. Tests for the pure logic you add (for example which render path is used per mode); the layer rule stays (render never imports game or ui). `npm run check` must pass.
9. Deliver by pushing to main if you have GitHub access, otherwise a zip of only changed files plus the report.

## Allowed / not allowed
Allowed: src/render (not src/render/assets), tests, docs. Not allowed: src/render/assets, src/game, src/universe, src/save, src/ui (nothing in this stage needs it).

## Report must include
Triangle and draw-call impact, anything that costs frame rate on a phone, and a short phone checklist for Andy (what to open, what to look at, how to report).

## Andy checks (after a green Actions run)
Play a trip (`?speed=600`), press Cockpit view: the new cockpit is there, space shows through the window, lights flash, no stretched edges, Orbit view as before, all three ships, desktop and phone (upright and sideways). Andy answers: matches what he approved in the viewer? Anything that looks different from the viewer?
