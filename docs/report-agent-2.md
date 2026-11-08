# Agent 2 report: Universe Generator

**Status: BUILT and checked in my workspace. NOT yet verified by GitHub Actions or on the live site.** One small change to `vite.config.ts` is still needed to make `/debug.html` appear on the live site (see section 4, item 1).

## 1. What was built

All code is pure logic in `src/universe/` (no graphics). Same seed + same coordinates = same result, always. Nothing is stored.

- **Random numbers** (`random.ts`): a text-to-number hash (FNV-1a plus a scramble) and the well-known Mulberry32 generator. `rngFor(seed, "layer", coordinates...)` makes a fresh random machine for one specific thing, so making system B never changes system A.
- **Galaxy** (`galaxy.ts`): endless 3D grid of 10-light-year cubes, 0 to 3 systems per cube (about 1.1 average). `listSitesNear` (systems near a point) and `distanceBetweenSystems`.
- **System** (`system.ts`): name, star type and color (6 types), 1 to 8 planets.
- **Planet** (`planet.ts`): name, type (8 types), radius, three saturated hex colors, orbit data. Inner planets lean hot, outer planets lean icy or gassy.
- **Dock** (`dock.ts`): exactly one per planet, OUTPOST or STATION (gas giants are always stations). Has 3 goods it produces cheaply, 3 it wants, a passenger terminal yes/no. Outposts also have a purchase price (500 to 40,000 credits, rounded to 100) and two perks: fuel discount (5% to 20%) and passive income per hour (price / 800, at least 5). Stations are not for sale.
- **Economy** (`economy.ts`, `data/goods.ts`): 16 funny goods in 5 categories. Price = base price x dock role (produces 55-80%, wants 130-170%, otherwise 90-110%) x slow drift (gentle wave plus smooth wobble, at most about 3% per hour). Always clamped to 40% to 250% of base.
- **Jobs** (`jobs.ts`): about 6 offers per dock. Kinds built: TRADE (goods), PASSENGER, TOUR (2 to 3 stops). Each job has load type, item, amount, required hold, destination, stops, optional time limit, reward and a funny blurb. A reserved `special` field (always `null` now) and the kind names SCAN and RESCUE mark the place for the later scanning and rescue phase.
- **Names and jokes** (`names.ts`): generators for systems, planets, docks, passenger groups and blurbs.
- **Word lists in plain files you can edit**: `src/universe/data/words.ts` (name parts), `goods.ts` (goods and prices), `passengers.ts` (passenger groups), `blurbs.ts` (job jokes).
- **Settings in one place**: `src/universe/settings.ts`, including `MAX_JOB_DISTANCE = 25` light years.
- **Tests**: `tests/universe.test.ts`, 29 tests. They prove determinism, different seeds differ, order independence, every planet has exactly one outpost-or-station dock, prices stay inside limits and drift slowly, every job destination (and every tour leg) exists and is within range, names are never empty, no leftover `{placeholders}` in blurbs.
- **Debug page**: `debug.html` plus `src/debug.ts`. Plain text and tables, no Three.js. Seed box, time slot, coordinate boxes, nearby systems, one system's planets, one dock's goods and prices, and its job board.

Two design choices I made (tell me if you want them changed):
- A job board stays the same for 6 time slots (`JOB_BOARD_REFRESH_SLOTS` in settings.ts) so the board does not change every hour while you read it. The same seed + same slot still always gives the same board. Set it to 1 for a new board every hour.
- A dock's id is the same as its planet's id, for example `0:0:0:0/2` (system `0:0:0:0`, planet number 2).

## 2. How to run it and check it (exact steps)

1. Copy the contents of the delivered folder into your `Lazy-flight` folder. When Windows/Mac asks, choose **Merge** / **Replace the files**. (You will see `src`, `tests`, `docs` and `debug.html`. Your existing files are not touched, except see section 4 item 1.)
2. Open **GitHub Desktop**. You should see the new files listed on the left.
3. Write a short message in the box at the bottom left, for example `Add universe generator`, then click **Commit to main**.
4. Click **Push origin** (top right).
5. Open your repository on github.com, click the **Actions** tab, and wait for the newest run to show a **green tick**. If it is red, click it and send me or the Project Lead a screenshot.
6. Open `https://<github-name>.github.io/Lazy-flight/debug.html` and check:
   - A table of about 70 nearby systems appears, then one system's planets, a price table, and a job board with 6 rows.
   - Type seed `12345`, press **Show**, then change the seed to `999` and press **Show**: the system names must change. Go back to `12345` and press **Show**: they must be identical to the first time.
   - Reload the page (F5): the same things appear.
   - Click a blue system name, then a planet number: the dock prices and job board change to that dock.
   - Change the **Time slot** from 0 to 100: prices change a little (never wildly) and the job board changes.
   - The cube page at `.../Lazy-flight/` must still spin as before.

## 3. Live link

- Cube page: `https://<github-name>.github.io/Lazy-flight/`
- Debug page: `https://<github-name>.github.io/Lazy-flight/debug.html` (works only after the config change in section 4 item 1)

## 4. Known issues and what is NOT verified

1. **Needs one change in `vite.config.ts` (not done).** Vite only publishes `index.html` unless told about a second page. I could not see `vite.config.ts`, so I did not overwrite it. Without the change, `/debug.html` works when running locally (`npm run dev`) but will be missing on the live site. The Project Lead or Andy should paste the current `vite.config.ts` into the chat and I will return the exact full file.
2. **Not run: `npm run check`.** My workspace has no Vite or Vitest and no internet for installing them.
3. What I did run: strict TypeScript compile of all code with no errors (including the strictest options, so it should also pass your `tsconfig`); all 29 tests passing using a tiny stand-in test runner (the tests use normal `vitest` commands, so real Vitest should behave the same); and the debug page opened in a real headless browser from a compiled copy, with no console errors, seed change giving different systems, going back to the old seed giving an identical page, and reload giving an identical page.
4. Not verified: the real Vite build, the green GitHub Actions run, the live site, phone display of the debug page.
5. I did not see `tests/layer-rule.test.ts`. I avoided every forbidden word in `src/universe` (even in comments) and `src/universe` imports nothing outside itself, so it should pass.
6. The debug page is plain and wide; it works on a phone but tables may need sideways scrolling.
7. Time limits (`timeLimitSlots`) are random 12 to 48 hours (tours 36 to 72) and are not tied to distance yet. Agent 4 should decide how they relate to the 4-hour trip limit.

## 5. What Agent 3 (Rendering) needs to know

Import everything from `src/universe` (`import { ... } from "../universe"`). Never import from the files inside it.

```ts
const seed = 12345; // a number or any text

// Systems near a point (light years), nearest first
const systems = listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 25);
// StarSystem: { id: "0:0:0:0", name, position: {x,y,z}, star: { type, label, color: "#ff9a3c", radius }, planetCount }

// Planets of a system, closest to the star first
const planets = getPlanetsOfSystem(seed, systems[0].id);
// Planet: { id: "0:0:0:0/2", systemId, index, name, type: "ROCKY"|"DESERT"|"OCEAN"|"ICE"|"LAVA"|"GAS"|"JUNGLE"|"BARREN",
//           radius (Earth = 1; gas giants 5 to 11), colors: { primary, secondary, accent } as "#rrggbb",
//           orbitRadius, orbitPhase (0 to 1) }

// The dock of a planet (same id)
const dock = getDock(seed, planets[0].id);
// Dock: { id, name, kind: "OUTPOST" | "STATION", ... }  Draw an outpost on the surface, a station in orbit.

// Distance between systems / docks (light years)
distanceBetweenSystems(seed, idA, idB);
```

All colors are only text values; nothing in `src/universe` draws anything. Everything is computed on demand and is cheap; do not store results unless you want to.

## 6. What Agent 4 (Gameplay) needs to know

- **Time-slot rule**: time is a whole number `slot`, 1 slot = 1 hour. Same seed + same slot = same prices and same job board. Compute it from the clock with `Math.floor(hoursPassed)`.
- **Economy functions**:
  - `getPrice(seed, dock, goodId, slot)` returns credits per unit (whole number).
  - `getMarket(seed, dock, slot)` returns every good as `{ good, role: "PRODUCES"|"WANTS"|"NEUTRAL", price }`.
  - `GOODS` is the list of 16 goods: `{ id, name, category, basePrice }`.
- **Job board**: `generateJobBoard(seed, dock, slot)` or `getJobBoard(seed, dockId, slot)`. Boards refresh every `JOB_BOARD_REFRESH_SLOTS` (6) slots.
- **Job format**:
  ```ts
  {
    id: "0:0:0:0/0#0#2",         // unique
    kind: "TRADE" | "PASSENGER" | "TOUR" | "SCAN" | "RESCUE", // only the first three are generated now
    loadType: "GOODS" | "PASSENGERS",
    item: "gravity_grease",      // good id, or passenger group text
    itemName: "Gravity Grease",  // text to show
    amount: 20,                  // units or passengers
    requiredHold: "CARGO_BAY" | "PASSENGER_CABIN",
    originDockId, destinationDockId,
    stops: ["...", "..."],       // 1 stop normally, 2 to 3 for a TOUR; the last one is the destination
    totalDistance: 21.5,         // light years, whole trip
    timeLimitSlots: 16 | null,   // hours allowed after accepting
    reward: 403,                 // credits
    blurb: "funny text",
    unitPriceAtDestination: 21 | null, // goods jobs only
    special: null                // reserved for the later scanning/rescue phase
  }
  ```
- **Distance**: `distanceBetweenDocks(seed, dockIdA, dockIdB)` (0 if same system) and `distanceBetweenSystems`. `MAX_JOB_DISTANCE` is 25 light years, so a one-stop job is at most 25 ly from its origin; a tour leg is at most 25 ly, and `totalDistance` can be larger for tours (up to about 75). Agent 4 converts distance to hours with the 4-hour trip limit.
- **Outposts**: `dock.kind === "OUTPOST"` has `dock.outpostPrice` and `dock.perks = { fuelDiscount: 0.12, passiveIncomePerHour: 18 }`. Stations have `null` for both and cannot be bought.
- Passenger jobs only appear at docks with `hasPassengerTerminal`, and every stop of a passenger job also has one.
- Look-ups: `getSystem`, `getPlanet`, `getDock` return `null` for ids that do not exist.

## 7. Suggestions (labeled, not built)

- Suggestion: add a `package-lock.json` after the first local `npm install` (already accepted for later in the status file).
- Suggestion: a fuel price per dock (so the outpost fuel discount has something to discount). Agent 4 may need it.
- Suggestion: let Agent 6 tune reward numbers (they are simple formulas in `jobs.ts`).
- Suggestion: a "starting system" picker so every new game begins at a friendly, well-connected system.
