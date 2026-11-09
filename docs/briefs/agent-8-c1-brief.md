# Agent 8 brief, stage C1: cockpit interiors

You are Agent 8 (asset designer, viewer and debugger). Role, pipeline and viewer rules: docs/briefs/agent-8-brief.md, docs/ASSET-PIPELINE.md, docs/STYLE-GUIDE.md. Work on the CURRENT `main` (never an old zip). Read first: docs/cockpit-design-brief.md (APPROVED by Andy, the design source), docs/ROADMAP-cockpit.md, docs/report-agent-8.md, docs/report-agent-8-fix.md, docs/report-agent-3d.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), batches approved from the viewer like before. The only report is docs/report-agent-8-c1.md. Free flight and combat are permanently out: the cockpit is a view only.

## Build
Three cockpit interiors as models in the registry, new catalog section "Cockpits (stage C1)": `cockpit-cargo-hauler`, `cockpit-passenger-liner`, `cockpit-scout`.
- Same bones (dashboard position, seat positions, `eye` position matching the ship's `eye` anchor), different frame, window and dashboard styling. Window shapes: Hauler = several flat panes with struts; Liner = one wide panoramic strip; Scout = rounded canopy. Half-and-half: window about half the view, chunky frame, visible busy dashboard (switches, dials, blinking lights, funny labels as small coloured shapes, no readable text needed).
- Dashboard has flat "screen" faces for Agent 5's later panel info (destination, time, fuel, next stop, route map). Give them anchors: `screenInfo`, `screenMap`, `screenFuel` (position, facing, size in units) and keep them unlit-flat so text can be drawn on them later.
- Co-pilot: a low-poly DOG in the second seat on the Hauler and Liner ONLY (not the Scout). Original design, sleeping pose. No animation now (dog animations are an Andy-approved SUGGESTION for later, do not build). Anchor `dog`.
- Lighting by colour only (no real-time lights): teal and amber glowing screens, a small warm lamp shape over the dashboard/dog seat. Provide a `windowLight` anchor/mesh tint hook so Agent 3 can tint light coming in by planet colour later.
- Nothing of the player's own ship visible through the window. The outside must never be hidden by inside faces: add a checker rule "faces block the window opening".
- Budget: up to 2000 triangles per cockpit, dog included; few meshes, one material each where possible. Animation: blinking lights via `update(t)` as before.
- Origin/orientation: origin at the `eye` point, looking -Z, up +Y, 1 unit = 1 crate.

## Viewer
Add a "Sit inside" mode for cockpits: camera at the eye, game resolution preview (desktop and phone), field-of-view setting, and a "show window cut-out" toggle. Keep all existing tools working. Add tests to tests/assets.test.ts (anchors, budgets, window-block rule, dog only on hauler/liner, ids unique).

## Not allowed
Anything in src/render scenes (Agent 3 does the integration in stage C2), src/game, src/universe, src/ui. Allowed: src/render/assets, src/models.ts, models.html, tests/assets.test.ts, docs.

## Andy checks
After a green Actions run, in /models.html: "Sit inside" each cockpit; same bones, different feel; dog on Hauler and Liner only; nothing blocks the window; phone view. Andy answers per cockpit: keep / change what.
