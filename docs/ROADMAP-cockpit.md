# Roadmap: new cockpits

Goal: when the ship is flying, the player can switch to the COCKPIT view and see the star systems through the ship's own windows, in the PS1 look. Docked view (home screen) and the Jobs/Shipyard menus are not changed. The cockpit is a VIEW ONLY: no steering, no free flight, no combat (permanent rule).

## What "the cockpit view" is made of
1. The room: dashboard, window frame (struts), seat edge, side panels. Different for each of the 3 ships.
2. The window: what you see outside (planets, stars, the warp tunnel, your own engine glow on the hull edges).
3. Light and screens inside: small glowing panels, blinking lights.
4. Information on the panels: where you are going, time left, fuel. Information only.
5. Camera: sits at the ship's `eye` anchor; small sway, shake and warp effects.
6. The pixel look on top of everything (3e).

## Stages (one agent each, in this order; each ends with a live build Andy approves)

| Stage | Agent | What | Output | Andy approves by |
|---|---|---|---|---|
| C0 | Lead (with Andy) | Cockpit design interview, max 5 questions: how much of the screen is frame vs window, how busy the dashboard, which info on panels, funny details, look per ship | One-page cockpit design brief in docs | Reading and saying "approved" |
| C1 | Agent 8 | Design the 3 cockpit interiors as models (same pipeline: style guide, viewer, checker). New viewer mode "Sit inside" at the `eye` anchor at game resolution; window opening shapes; triangle budget 2000 per cockpit, dog included (see docs/cockpit-design-brief.md) | 3 approved cockpit models in the catalog (new section) | The viewer, per ship, like the ship designs |
| C2 | Agent 3 | Integrate: cockpit model follows the camera in flight; window shows planet/stars/tunnel correctly; replaces the old frame overlay; sway and shake; Orbit/Cockpit switch keeps working; ship by id | Cockpit view in the real flight, all 3 ships | Full flight in `?ship=` each ship, cockpit view, phone upright and sideways |
| C3 | Agent 5 | Information on the cockpit panels (destination, time left, fuel) as readable pixel text inside the 3D view or crisp overlay aligned to the panels. Information only | Readable, honest info on panels | Reading it on a phone |
| C4 | Agent 3 (part 3e) | The PS1 pixel look over the whole game (banding, grain, optional wobble), flames, warp flash | Look settings in `settings.ts` | "Does it feel PS1?" |
| C5 | Agent 6 | Phone frame rate in cockpit view for each ship, window crop on odd screens, regression tests | Short QA report | Report |

Rules: a stage starts only after the previous one is live and approved. C1 can run in parallel with Agent 5's current work (different files). C3 may be dropped if C2's info is enough (Andy decides after seeing C2).

## Decisions needed from Andy at C0 (preview)
1. Window share: big open window with thin frame, or heavier frame like a real cockpit?
2. Dashboard: tidy and simple, or crowded and funny?
3. Should the player see the ship's own nose/wings through the window?
4. Anything alive inside (a dangling charm, a coffee cup, a sleeping co-pilot)? Suggestion only.
5. Different feel per ship (Hauler wide/utility, Liner elegant, Scout cramped)? Suggested yes.

## Risks
- Phone speed: a 3D room plus planets can be heavy. Fix: tiny triangle budget, no real-time lights, test early in C2.
- Window cutting: the outside must never be hidden behind inside faces. Fix: checker rule in C1 (same as the bay rule).
- Old cockpit overlay (`src/render/cockpit.ts`) is replaced in C2; keep it until then.

## UPDATE 2026-11-10 (after Agent 8's C1 report)
- C1 DONE: one base cockpit for all three ships (Andy's instruction at the restart), about 2,400 triangles (budget for the restart is 3,000), 70-degree lens view, anchors screenInfo/screenMap/screenFuel. Dog, warm lamp, window light and per-ship differences are DEFERRED by Andy (suggestions, not built).
- C2 is split: C2a = cockpit into the flight view (Agent 3, brief docs/briefs/agent-3-c2a-brief.md); C2b = trip info on the three screens (Agent 3, brief docs/briefs/agent-3-c2b-brief.md). C3 (Agent 5) is no longer needed: the screens are drawn in the render layer from flight info. Agent 5 is only needed if the HTML read-out should change.
- 3e (pixel look) still on hold; its cockpit-frame item is replaced by this work.
