# Proposal: ship upgrades (for Andy's approval, nothing built yet)

Why: after all outposts are bought, an attentive player has nothing left to spend credits on (Agent 6 sim: about 100,000 credits after 30 hours). Upgrades give credits a long-term use and make each ship feel like yours. They stay inside the 3-ship limit.

## The idea (small)
Each owned ship has 3 upgrade tracks, 3 levels each (base level 0):
| Track | Effect per level | Why it matters |
|---|---|---|
| Fuel tank | +15% tank size | longer trips, fewer "too far for this tank" jobs |
| Hold / cabin | +15% cargo and cabin space | bigger jobs |
| Efficient engines | -8% fuel burned per ly | cheaper trips |

- Prices (proposal, whole credits, Agent 6 will tune by simulation): level 1 = 15% of the ship's price class base ... a simple rule: 2,000 / 6,000 / 15,000 credits per level, same for all tracks (so 3 tracks x 3 levels = 69,000 credits per ship).
- Upgrades belong to a ship (switching ships switches its upgrades). No selling or removing.
- Buy at any dock when no job is in flight, like ships. In the Shipyard screen each ship card gets an UPGRADES button.
- The ship model does not change (no new art). Optional later suggestion: a small badge or colour stripe per level.
- Saves: new field with a default (old saves load as level 0).

## Who does what
1. Agent 4: rules, state, API (`getUpgradeOffers`, `buyUpgrade`), tests, extend /game-debug.html.
2. Agent 5: Upgrades panel in the Shipyard.
3. Agent 6: re-run the balance simulation (credits sink, first ship / outpost timing unchanged) and propose price changes.

## Questions for Andy
1. Are these three tracks right, or do you want different ones (e.g. cabin comfort that raises passenger pay)?
2. Are 3 levels per track and the price range right? (about 69,000 per ship)
3. Do upgrades stay with the ship (proposal) or with the player?

## Scope check
This adds a feature to v1. It needs your approval. If you say yes, the order is Agent 4, then Agent 5, then Agent 6, one at a time.
