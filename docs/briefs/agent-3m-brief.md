# Agent 3 brief: faint sky backdrop on the docked and flight screens (small)

You are Agent 3 (Rendering). Work on the CURRENT `main` (universe v3 is merged). Read only: docs/status.md (last 40 lines), docs/report-agent-3k.md (the part about the system-view backdrop: `SYSTEM_SKY_*`, `skylayer`, `backdrop`), and the files `src/render/docked.ts`, `src/render/flight.ts`, `src/render/systemview.ts`. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), at most 4 steps. Saving Andy's usage matters: no extra reading. Combat never. Report: docs/report-agent-3m.md (short).

## Do
Andy approved your suggestion: the faint galaxy backdrop (the glow from where you stand, built from the real universe, the same one the system view already has, strength `SYSTEM_SKY_FAINT = 0.25`) also behind the DOCKED screen and the FLIGHT / floating screens, so every screen shows the same sky for the same system. Reuse the system view's code (do not copy it); the sky is built once per system and reused. Phone speed: report FRAME on Andy's iPhone for docked and flight (60 fps today). Keep `tests/agent6c.test.ts` happy: do NOT add more `launchSeconds:` / `this.phases = ` literals in `flight.ts`; if it cannot be done without them, stop and tell the Lead. If the backdrop disturbs the ship's look or the pixel look, show options A/B/C.

## Allowed / not allowed
Allowed: `src/render` (docked, flight, backdrop, skylayer files), render tests, docs. Not allowed: `src/universe`, `src/game`, `src/ui`, `src/save`, workflows.

## Andy checks
Docked and flight screenshots of two different systems: different sky behind the ship, ship still looks right, phone still smooth.
