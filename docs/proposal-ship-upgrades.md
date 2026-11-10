# Ship upgrades: APPROVED by Andy 2026-11-10

Why: after all outposts are bought an attentive player has nothing to spend credits on (about 100,000 credits after 30 hours). Upgrades give credits a long-term use and make each ship feel like yours, inside the 3-ship limit.

## Andy's decisions
- **Four tracks** per ship: fuel tank, hold / cabin size, efficient engines, passenger comfort.
- **Five levels** per track (base = level 0).
- **Upgrades stay with the ship.** Each ship has its own upgrades; switching ships switches them. No selling or removing.

## Starting numbers (Lead proposal; Agent 4 puts them in settings, Agent 6 tunes them by simulation)
| Track | Effect per level (5 levels) | Max |
|---|---|---|
| Fuel tank | +10% tank size | +50% |
| Hold / cabin size | +10% cargo and cabin space | +50% |
| Efficient engines | -6% fuel burned per light year | -30% |
| Passenger comfort | +6% pay on passenger and tour jobs | +30% (passenger/tour jobs only) |

Prices per level (same for all tracks, whole credits): 1,500 / 4,000 / 9,000 / 18,000 / 35,000. A full track costs 67,500; all four tracks on one ship 270,000. Goal for the balance pass: the first level of a track should come within about a session or two after the first ship; the last levels are the long-term sink. Agent 6 may propose changes; Andy decides.

## Rules
- Buy at any dock when no job is in flight (like ships), one level at a time, in order.
- Effects apply to the ship's tank, hold, cabin, fuel burn and pay; rank limits and outpost bonuses work as before (upgrade bonuses stack with them additively on the plain reward, Agent 4 decides the exact order and tells the Lead).
- Ship models do not change (no new art). Optional later suggestion: a small badge per level.
- Saves: a new field with a default (old saves load at level 0). Per-ship fuel stays valid when the tank grows or shrinks (clamp).

## Who does what (one at a time, each verified by Andy)
1. **Agent 4** (brief docs/briefs/agent-4d-brief.md): rules, state, API, tests, /game-debug.html.
2. **Agent 5:** Upgrades panel in the Shipyard (brief written after 4d).
3. **Agent 6:** re-run the balance simulation with upgrades and propose price changes.
