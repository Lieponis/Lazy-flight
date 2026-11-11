# Plan: fewer docks, bigger systems (Lead plan, decided by Andy 2026-11-11)

## What Andy wants
Not every planet has a dock any more. Per system, 1 to 3 docks (stations or outposts, a mix), scaled by system size: about 3 planets = 1 dock; 6 planets = 1 to 2; 10 planets = 1 to 3. Systems may have up to 10 planets (today 1 to 8).

## Decisions (Andy, answered 2026-11-11)
1. Systems may have up to 10 planets (planet count range 1..10).
2. Old saves: move + refund (below).
3. The same seed gives a different universe than before (planets re-rolled because the count range changes, docks only on some planets). OK. This is "universe version 2".

## The rule (Lead proposal for Agent 2)
- `planetCount` = 1..10 (`MIN_PLANETS` 1, `MAX_PLANETS` 10).
- `maxDocks = clamp(round(planetCount / 3.3), 1, 3)` (1-4 planets: 1; 5-8: 2 (5 rounds to 2); 9-10: 3). Number of docks in the system = a deterministic random integer from 1 to `maxDocks`.
- Which planets get docks: deterministic choice per system (gas giants only as stations, as today; any planet may be chosen). Dock id stays equal to its planet id, so `getDock(seed, id)` returns null for a planet without a dock (that function already says so).
- Everything else about a dock (kind, name, goods, passenger terminal, outpost price and perks) stays as today.
- New exported constant `UNIVERSE_VERSION = 2`.

## Old saves ("move + refund")
Because the planet count range changes, old dock ids can mean something different or nothing. A save written for universe version 1 is migrated on load, keeping the player's progress:
- Keep: credits, ranks, ships owned, ship upgrades, sound settings (separate key).
- Location: moved to the system's... no: the old system may be different now. Rule: the ship is placed at the start dock of the new universe (same starting rule as a new game).
- Job in flight or accepted: cancelled (cargo returns), no penalty.
- Owned outposts: removed, and the player is refunded each one's ORIGINAL purchase price in credits (use the price stored/recomputable from universe v1 rule; Agent 4 decides how to get it, simplest: store a price paid from now on, and for older saves use the base formula or a flat estimate, tell Andy).
- Delivered-job list: cleared.
- The save gets `universeVersion: 2`. A short message on the first load: "The universe was rebuilt. Your credits and ships came with you."
- Saves already at version 2 load normally. A save without `universeVersion` counts as 1.

## Stages (one at a time; each verified by Andy)
| Stage | Agent | What |
|---|---|---|
| U1 | Agent 2 | Universe change in `src/universe` (+ debug page `/debug.html`), tests proving determinism and the dock-count rule, `UNIVERSE_VERSION`. Brief: docs/briefs/agent-2b-brief.md. May run in parallel with Agent 7's 7c (7c is render-only). |
| U2 | Agent 4 | Game/save adaptation: migration above, start dock, board/jobs/tours with fewer docks (jobs only to docks), stuck check, outposts refund, tests, `/game-debug.html`. Brief written after U1. |
| U3 | Agent 3 and Agent 5 (one after the other, or in parallel) | Render and UI: system view with up to 10 planets (some without a dock: scenery, not selectable as a destination), map and Jobs show only docks, docked view/dock pickers. Briefs written after U2. |
| U4 | Agent 6 | Balance rerun (fewer destinations: job supply, trip length, outpost availability) and QA. |

## Risks
- Fewer docks means fewer destinations: a system with one dock has no same-system jobs, and sparse areas may have few jobs within 25 light years. U1 must report jobs per board across many seeds; U4 re-balances. If boards are too thin, the Lead adjusts `MAX_JOB_DISTANCE` or the minimum docks (Andy decides).
- Outposts for sale become rarer (about 4 in 10 docks are outposts). Check the first-outpost time.
- Up to 10 planets must still look good and run well on phones in the system view (U3).
