# Agent 5 report, NAV-3 (5k): MY PLACES and FLIGHT PLAN

On main in commit e4dc1d2, live. Andy chose:
- MY PLACES rows: **A**, grouped START / OUTPOSTS / STARRED / RECENT; tap a row and its buttons open under it.
- Badges: **A**, `READY TO FLY` / `REFUEL FIRST` / `NEEDS HOPS`.
- FLIGHT PLAN: **B**, a big NEXT HOP card first.

He checked everything live on his phone: "Ok".

## What was built
- **MY PLACES** (`src/ui/places.ts`), opened from MENU (docked) and from PLACES in the map bar.
  - The rows come from `game.getPlaces()`. Each shows the full name, the system name and distance (or YOU ARE HERE), and a badge.
  - An open row shows the game's `reachText` and the buttons SET AS DESTINATION, SHOW ON MAP and ☆ STAR / ★ UNSTAR. The current destination row is marked "◆ YOUR DESTINATION".
- **FLIGHT PLAN** (`src/ui/flightplan.ts`), opened from MENU, and right after SET AS DESTINATION.
  - It asks `planRoute` every time it opens and on every game change.
  - The NEXT HOP card shows the hop name, system, ly and fuel, plus discovery pay. Its button is FLY NEXT HOP, which uses `canFreeTravel` / `freeTravel`. When `refuelBefore` is true and the ship is docked, the button is REFUEL instead.
  - Below the card: the totals line, the other hops ("Refuel first (about N CR)" where needed), "The plan shows the next 20 hops of about N…", SHOW ON MAP (Agent 3's `showMapRoute`) and CLEAR DESTINATION.
  - For other plan statuses the box gets a friendly title: YOU MADE IT, NO WAY OUT FROM HERE, THE TRAIL GOES COLD or UNKNOWN PLACE. The game's sentence is shown with one hint.
- **Star buttons:** ☆/★ next to MAP in the docked view, and on the planet card for docks. A full list shows the game's reason plus "Unstar one in MY PLACES first."
- **Destination:** a UI preference in this browser only (localStorage `lazy-flight.nav-target`), not in the save. The map line gets the plan through `setMapRoute(mapNav.route(plan))`, asked again only when the place, ship or destination changes.
- **Overlays:** `places` and `plan` may open on the maps and when floating, never in flight (`overlayAllowed`).
- **Text helpers:** `src/ui/navlogic.ts`, tested in `tests/ui-nav.test.ts`.
- **Fix from 5j:** the map legend glue compared `overlay === null`, so the legend never showed. It now checks `"none"`, and the legend has a dark strip so it stays readable over bright stars.

## Files
- New: `src/ui/navlogic.ts`, `places.ts`, `flightplan.ts`, `tests/ui-nav.test.ts`.
- Changed: `index.ts` (glue), `navbar.ts`, `gamemenu.ts`, `planetpanel.ts`, `logic.ts` (Overlay, overlayAllowed), `theme.css`.

## Status
- `npm run check` green (1,304 tests). "Build and publish" green.
- Headless check at 360×640: no page scroll, no errors. FLY NEXT HOP started a real free trip in the check.

## Notes
- The destination is not in the save. It lives in this browser only, so a save file moved to another device has no destination.
- Long distances wrap "ly" to the next line on 360 px (for example "18,065.8 / ly"). This is harmless.
