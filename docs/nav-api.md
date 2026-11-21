# NAV-1 API: MY PLACES and the hopping flight plan (for Agents 3 and 5)

Status: agreed names and shapes (stage NAV-1, Agent 4). The methods are added to `Game` in the next steps; this page is the contract. Nothing here changes existing names or texts. Balance numbers (fuel, prices, reach) are unchanged.

## Ids (as in docs/universe-v3-game-api.md)
- System id = number. Dock id and planet id = text `"<system>/<planet index>"`.
- A **place id** is either a dock id (`"44776692551/2"`) or a system id written as digits (`"44776692551"`, no slash = "this star system, at its first dock"). Every system has at least one dock.

## Save fields (new, small; old saves get empty lists, no save version change)
- `state.recentDocks: string[]` newest first, no duplicates, at most 10 dock ids. Filled by `Game` whenever the ship docks after a trip (job arrival, free-travel arrival to a dock). Loading adds nothing, but `getPlaces()` always counts the dock you are docked at as the newest recent one.
- `state.starredPlaces: string[]` place ids the player starred, at most 30, in the order starred.
- Start dock and owned outposts are NOT stored again: they are read from `startDockOf(seed)` and `state.ownedOutposts`.

## Places
```ts
type PlaceKind = "start" | "outpost" | "recent" | "starred";
interface Place {
  id: string;            // place id (dock id or system digits), the key for star/unstar and for planRoute
  kinds: PlaceKind[];    // one row per place; all kinds that apply, e.g. ["outpost","starred"]. Never listed twice.
  name: string;          // full unique name of the dock ("Breezy Hill Outpost") 
  systemId: number;
  systemName: string;    // full unique system name
  dockId: string | null; // the dock to fly to (null only if a system id has no dock, never happens today)
  distanceLy: number;    // from the ship now (0 = here), 1 decimal
  fuelNeeded: number;    // for one direct trip, same rule as job cards
  reach: "now" | "refuel" | "never"; // same words as the job cards (now = fuel on board, refuel = fits the tank, never = longer than a full tank)
  reachText: string;     // plain sentence, same style as job cards
  starred: boolean;
  isHere: boolean;
}
game.getPlaces(): Place[]      // order: start, outposts, starred, recent (newest first); a place appears once
game.starPlace(id: string): { ok: true } | { ok: false; reason: string; full?: true }
game.unstarPlace(id: string): { ok: true } | { ok: false; reason: string }
game.isStarred(id: string): boolean
```
- Any dock or star system that exists can be starred (the UI offers it on a dock or system the player knows).
- Starring the 31st returns `{ ok: false, full: true, reason: "You can star 30 places. Remove one first." }`; the UI shows the reason and the starred list so the player can call `unstarPlace`. Starring twice returns `ok: true` (nothing changes). Unknown ids return `ok: false` with a plain reason.
- `getPlaces()` is cheap (at most about 50 rows, a few lookups each).

## The flight plan
A plan is asked for with `game.planRoute(targetId)` (a place id; a dock id of the same system is fine). It is pure, deterministic, never changes the game, and is computed fresh each call (ask again after every arrival).
```ts
interface RouteHop {
  index: number;          // 1-based
  dockId: string;         // where this hop lands (always a dock, so the ship can refuel)
  dockName: string;
  systemId: number;
  systemName: string;
  distanceLy: number;     // from the previous stop, never more than rangeLy
  fuelNeeded: number;     // for this hop
  refuelBefore: boolean;  // true = the fuel on board is not enough for this hop: refuel at the stop you are leaving first
  refuelCredits: number;  // estimated cost of that refuel (2 credits per unit at the stop you leave, less if you own an outpost there)
}
interface RoutePlan {
  status: "ok" | "here" | "too-far-no-docks" | "stuck";
  target: { id: string; name: string; systemId: number };
  hops: RouteHop[];       // at most 20 (the next 20); empty unless status is "ok"
  moreHops: boolean;      // true when the plan shows only the next 20 hops of the whole way
  hopsTotalEstimate: number; // about how many hops the whole way takes
  totalLy: number;        // sum of the shown hops
  totalFuel: number;
  totalRefuelCredits: number; // estimate, only the shown hops
  rangeLy: number;        // one full tank of the current ship (same as getPlaceInfo().rangeLy)
  closestLy: number | null;   // stuck only: distance to the target from the closest point reached
  gapLy: number | null;       // stuck only: the empty gap (ly) to the next dock the ship could not cross
  message: string | null;     // plain sentence for every status except a plain "ok" ("The plan shows the next 20 hops of about 61.")
}
game.planRoute(targetId: string): RoutePlan
game.nextHop(targetId: string): RouteHop | null   // = planRoute(targetId).hops[0] or null
```
Statuses: `ok` (hops listed), `here` (you are already at that place or in that system with a dock: no hops), `too-far-no-docks` (no dock lies within one full tank of the ship's place at all, the far-dock case from G4), `stuck` (greedy hopping with a short look-ahead cannot get closer: `closestLy` and `gapLy` say how far).

Rules (so the screens can explain them): every hop lands at a dock; every hop is at most one FULL tank of the current ship (`rangeLy`, tank size, not the fuel on board); each hop gets closer to the target; the plan is for the ship you fly now (switch ship and ask again).

## Flying a hop
Nothing flies by itself. The player flies each hop with the existing `game.freeTravel(hop.dockId)` (check first with `game.canFreeTravel(hop.dockId)`, which also tells the discovery credits). Strand protection, discovery credits and explorer counts work exactly as for any free trip. After the arrival (`game.update()` returns the arrival, state changes) call `planRoute` again: the first hop of the new plan is the next one. If `refuelBefore` is true, call `game.refuel()` first (only possible while docked).

## What changes for the screens
- Agent 3 (map): draw the line from `[current system, ...hops.map(h => h.systemId)]`; mark places from `getPlaces()` (`systemId`, `kinds`). Positions come from the universe as today (`nearbySystems` is not needed for the plan).
- Agent 5 (UI): MY PLACES list = `getPlaces()` (show `reach` with the same badges as job cards, `distanceLy`, a star toggle). FLIGHT PLAN screen = `planRoute(target)` (table: hop, name, ly, fuel; totals; `message`). A "next hop" button calls `freeTravel(nextHop.dockId)`.
- Not changing: `freeTravel`, `canFreeTravel`, job cards, `getPlaceInfo`, save version (stays 1).
