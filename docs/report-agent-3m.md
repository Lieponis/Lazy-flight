# Agent 3 report, stage G8 ("3m"): the same faint galaxy sky on every screen

Status: done, live on main (Build and publish green). Checked by Andy on his iPhone.

## What was built

The faint galaxy backdrop the system view already had (`SYSTEM_SKY_FAINT = 0.25`) now also sits behind:

- the DOCKED screen (ship in the dock),
- the FLIGHT screen, both the outside (orbit) view and the cockpit view,
- the floating-in-space flight.

Every screen shows the same sky for the same system. A different system gives a different sky.

## How (no copied code)

- `src/render/systemsky.ts` (new): one factory `makeSystemSkyLayer(fns)` that builds the sky with the system view's settings, and one helper `renderWithSky(renderer, sky, scene, camera)` that clears, draws the sky, then draws the scene on top. If there is no sky yet it falls back to a plain render.
- `src/render/systemview.ts`: now uses those two instead of its own copy.
- `src/render/docked.ts` and `src/render/flight.ts`: new option `skyLayer`; they point it at the current system on open / on trip start, call `sky.update(...)` each frame, and draw through `renderWithSky`.
- `src/render/assets/lens.ts`: `CockpitLens.render(...)` takes an optional `before` hook so the sky is drawn inside the hidden cockpit picture, with the same wide camera. Without the hook it behaves exactly as before.
- `src/render/index.ts`: builds the sky once (`stageSky`) and gives the same layer to docked and flight, so a map pick cannot change the sky behind the ship. While another screen is active it keeps building the sky in idle slices (`SYSTEM_SKY_IDLE_MS`), so it is ready when you dock or fly.
- `src/render/mapstats.ts`: new `FrameLine` / `frameLineText` aid. With `?mapstats=1` in the address, the docked and flight screens show one line: `DOCKED` or `FLIGHT`, `FRAME ... ms (... fps)`, `JS ... ms`.

Brief rules kept: nothing outside `src/render`, render tests and docs was touched. No new `launchSeconds:` or `this.phases = ` literals in `flight.ts` (still 2 matches, as before). The flight backdrop line pinned by `tests/starfield.test.ts` is unchanged; the sky is pointed with a separate `pointSkyAt(...)` call next to it.

## Numbers (Andy's iPhone, Safari, `?mapstats=1`)

| Screen | FRAME | JS |
|---|---|---|
| Docked (Breezy Hill Outpost, Bimvik Deep) | 16.7 ms (60 fps) | 0.5 ms |
| Flight, in warp (to Spinning Teapot Station, Niblon) | 16.7 ms (60 fps) | 0.6 to 0.9 ms |
| Flight, cockpit view | 16.6 ms (60 fps) | 2.0 ms |

## Andy's checks

- Docked, two systems (Cheerful Flats Outpost in Brania J4292-77TD, Breezy Hill Outpost in Bimvik Deep): different sky behind the ship, galaxy band with dark dust lane, ship and docks look right.
- Flight in warp: ship looks right, faint band visible behind the warp streaks.
- Cockpit view: not broken; cockpit, panels and the sky behind the windscreen all show.
- Phone stays at 60 fps on all three.

## Options A/B/C

Not needed. The backdrop did not disturb the ship's look or the pixel look, so nothing was dialled down.

## Tests

`tests/stagesky.test.ts` (new): draw order of `renderWithSky` with fakes; the lens `before` hook runs after the clear and before the scene, with the wide camera, and without the hook nothing changes; two layers from the factory build the same sky for the same place; `FrameLine` text; source-wiring checks (screens use `renderWithSky`, no `new SkyLayer(` in them, exactly one `makeSystemSkyLayer(` in `index.ts`, the exact `pointSkyAt` calls).

One CI failure on the way (mine): `tests/starfield.test.ts` pins the exact flight-trip line `reseedBackdrop(... parseDockId(info.destinationDockId)?.systemId ?? null)`. I had changed it; restored the line exactly. Fixed in c0df18e, green after.

## Known issues and limits

- The test environment has no screen, so docked, flight and the lens cannot be built in tests. They are covered by fakes, source checks and Andy's phone screenshots. Real three.js ran only on CI and on Andy's phone, never in my workspace.
- The installed home-screen app cannot take `?mapstats=1`, so the FRAME line only shows in Safari.
- In warp the streaks cover most of the sky, so the sky is easiest to see in the cockpit view or when drifting.
- The first sky for a system builds in slices, so it fades in a moment after docking in a system you have not been near. It was not noticed in Andy's checks.
- Dark pole smudges in the sky: Andy decided to leave them as they are (G7b).

## Next agent needs to know

- Any new screen that should show the sky: pass the shared `skyLayer` (`stageSky`) and draw through `renderWithSky`. Do not construct another `SkyLayer`.
- Do not add `launchSeconds:` or `this.phases = ` literals to `flight.ts` (`tests/agent6c.test.ts`).
- `?mapstats=1` in Safari gives the FRAME line for the system view, map, docked and flight.

## Suggestion (not built)

None.
