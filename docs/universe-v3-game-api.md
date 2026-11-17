# Universe v3: what the game layer gives Agents 3 and 5 (stage G4, step 1)

Written by Agent 4 on branch `universe-v3`. Short on purpose. "**NEW**" = a name Agent 4 promises and codes in G4 step 2 (the names will not change). Everything else exists today. Universe facts: `docs/report-agent-2e.md` sections 2, 3, 5 and `src/universe/README.md`.

## 1. Id types (the one rule)
| Thing | Type | Example |
|---|---|---|
| star system id | **number** (whole, up to about 4.7e10, safe in JSON) | `44776692551` |
| planet id = dock id | **string** `"<system number>/<planet number>"` | `"44776692551/2"` |
| job id | string `"<dock id>#<period>#<offer>"` | |
| ship, paint job, good ids | strings (unchanged) | `"scout"`, `"rescue-red"` |

- Old shape ids (`"3:-2:5:0/2"`) match nothing anywhere: lookups give `null`, `[]` or `false`; `isLegacyId(id)` tells them apart from garbage.
- The game stays on these types. **Changed in the game (G4):** `Game.currentSystemId()` returns a **number** (was string); `OwnedOutpost.systemId` is a **number**; `parsePlanetId(id)` returns `{ systemId: number, index }`; `discoveryBase(seed, systemId: number)`.
- **`explored`** in the save is `Record<string, number>`: the key is the system number written as digits (`"44776692551"`, JSON keys are always text), the value is the planet bit mask. Use `hasExploredSystem(explored, number | string)`. Do not read the keys yourself; use `game.getExplorer()` (counts, rank, bonus).

## 2. GameState (ids only; the rest is unchanged)
`currentDockId: string` (the dock you are at, or last used) · `spacePlanetId: string | null` (planet without a dock where you float) · `currentJob: Job | null` (`originDockId`, `destinationDockId`, `stops[]`: strings) · `freeTrip: { fromId: string; toId: string; distanceLy: number } | null` · `ownedOutposts: string[]` (dock ids) · `outpostPrices: Record<dockId, credits>` · `explored` (above) · `deliveredJobIds: string[]` · `travelStartMs / travelEndMs: number | null`. Nothing else holds a universe id.

## 3. Save
`SaveData { version: 1, seed: number, savedAtRealMs, gameNowMs, universeVersion: number, state }`. `SAVE_VERSION` stays 1; `universeVersion` becomes **3** (`UNIVERSE_VERSION`). A save with a lower number is **moved** on load (credits, fuel, ships, upgrades, paint jobs, ranks, completed counts, times kept; player put at the start dock `startDockOf(WORLD_SEED)`; job and free trip cancelled; outposts refunded; explored and delivered ids cleared). The same happens to an imported file. `planStart(...).notice` carries the "universe rebuilt" text **once** (Agent 5 writes the words, as for the v2 move); `inspectImport` result keeps `warnings[]`.

## 4. Methods you call (all on `Game`, ids as above)
| Call | Takes | Gives |
|---|---|---|
| `getBoard()` | | `BoardEntry[]` (6, or `[]` while flying or floating). Entry = `{ job, baseReward, bonusPercent, fuelNeeded, tripSeconds, block, **reach, reachText** }` |
| `accept(jobId)` | job id string | `{ ok: true }` or `{ ok: false, block }` |
| `canFreeTravel(targetId)` | **planet or dock id string** `"<n>/<i>"` | `{ ok: true, targetId, targetName, isDock, distanceLy, fuelNeeded, fuelLeft, seconds, discoveryCredits, newSystem }` or `{ ok: false, reason }` |
| `freeTravel(targetId)` | the same | `{ ok: true, fuelUsed, seconds }` or `{ ok: false, reason }` |
| `placeName(id)` | dock or planet id | text |
| `getExplorer()` | | counts, rank, bonus, progress (unchanged) |
| **NEW** `getBoardSummary()` | | `{ total, doNow, afterRefuel, never, message: string \| null }`. `message` is plain text when no job can be taken now, or never |
| **NEW** `getPlaceInfo()` | | `{ systemId: number, systemName, placeId, isDocked, rangeLy, fuelRangeLy, nearestOtherDock: { dockId, name, systemId, distanceLy } \| null, isRemote, remoteMessage: string \| null }` |
| **NEW** `nearbySystems(count = 40)` | | `NearSystem[]` (`{ system: StarSystem, distance }`), nearest first, around the player's **current place** (includes your own system at distance 0) |
| **NEW** `nearbyDocks(count = 12)` | | `NearDock[]` (`{ dockId, systemId, planetIndex, position, distance }`), nearest first |

- `reach` on a board card: `"now"` (enough fuel), `"refuel"` (fits the tank, fuel needed first), `"never"` (more than a full tank of this ship, "too far for this ship"). `reachText` is the plain sentence ("Too far for this ship: needs 80 fuel, the tank holds 60."). `block` still carries the exact reason (also cargo, cabin, rank). Cards with `reach: "never"` stay on the board (grey them); the list is sorted as the universe gives it.
- `rangeLy` = longest trip a **full tank** allows; `fuelRangeLy` = with the fuel you have now. `isRemote` = the nearest other dock is farther than `rangeLy`.
- The map (Agent 3) should get its system list from `game.nearbySystems(count)` through the glue in `src/ui/index.ts` / `src/main.ts` (render never imports game). It uses one `NearCache` inside the Game: the same position again costs under 0.01 ms. A count, never a radius (80 ly at the centre holds 363,000 systems). `nearestSystems(seed, centre, 10000)` costs 30 to 55 ms on the cloud machine, so ask once per move, not per frame.

## 5. What a far dock looks like (nearest other dock 70 to 250 ly away; decided here)
A player cannot **arrive** at such a dock by normal play: a free trip is refused when the fuel left could not bring you back to a dock, and a job needs a trip that fits the tank. So it only happens at a start or through a developer link or a test save. Handling, so there is never a crash or an empty screen without a text:
1. `getBoard()` still returns the 6 cards, each with `reach: "never"` and its reason (jobs there have trips of 100 to 600 ly).
2. `getBoardSummary().message` is e.g. "Nothing here is within reach of this ship. The next dock is 71 ly away; your tank takes you 30 ly." (`doNow = 0`).
3. `getPlaceInfo()`: `isRemote: true`, `remoteMessage` set. The HUD shows that text on the board screen in place of the cards if `doNow + afterRefuel = 0`.
4. Free travel offers only places that pass the existing checks (fuel for the trip **and** the reserve to reach a dock); at a far dock the answer is the usual "Too far for this ship's tank" text, never a crash.
5. A ship that is stranded this way is **not rescued in G4** (suggestion for later: a free tow to the start dock, or the late long-range ship).

## 6. Rewards (so the card layout can plan)
Reward growth slows beyond 50 ly (curve in the G4 report). Card numbers always come from `BoardEntry.job.reward`; never compute a reward in the UI.

## 7. Not changing in G4
`tripFuelCost`, tank sizes, the 4 hour trip cap, ranks, explorer thresholds (50 / 200 discoveries), the shipyard, paint jobs, outpost rules. The save version number `SAVE_VERSION` and all `lazy-freight.*` keys.
