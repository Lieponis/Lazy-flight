# Agent 3 brief, stage C2b: trip information on the cockpit screens

You are Agent 3 (rendering). Start only after Andy has approved stage C2a (the cockpit is live in the flight view). Work on the CURRENT `main`. Read first: docs/INTEGRATION-cockpit.md (Part 2 is your recipe), docs/cockpit-design-brief.md, docs/report-agent-3-c2a.md, docs/report-agent-8-c1.md. Same one-step-at-a-time method. The only report is docs/report-agent-3-c2b.md. Cockpit is a view only: information, no controls.

## Goal
The three screens of the cockpit show the trip: information straight ahead, route map in the middle, fuel in amber on the pilot's (left) wing.

## Do
1. **Fuel into the flight info.** Add `fuel` and `fuelMax` to `FlightInfo` (optional fields, fuel left and the active ship's tank size). They are filled in by the glue in `src/ui/index.ts` from the game state (you may touch ONLY that glue for this; render must not import game or ui). Older code paths without them must still work.
2. **Three canvases drawn at pixel-art size** (info and map about 96 x 112, fuel about 96 x 64), `CanvasTexture` with nearest-neighbour filtering, no mipmaps, SRGB colour space. A plane on each screen anchor (`screenInfo`, `screenMap`, `screenFuel`: position, direction, size are in the anchors), a hair in front of the glowing screen, facing the pilot. Do not edit src/render/assets.
3. **What to draw** (big, simple, few words):
   - INFO (teal): `TO <destination>`, arrival countdown, phase (LAUNCH / WARP / APPROACH), and for tours the next stop if the flight info has it (if it does not, say so to the Lead and show destination only).
   - MAP (teal): origin dot, destination dot, line between them, ship marker at elapsed/total along it, a few star pixels. For tours show the stops as dots on the line if the data exists.
   - FUEL (amber): a bar fuel/fuelMax plus the number.
   - Light text (#e3e7ff) or cyan (#3fe0ff). Font: use the game's VT323 pixel font if it is loaded in the page (it is loaded by the UI's CSS; wait for it with `document.fonts` before the first draw, and fall back to a small monospace font), `imageSmoothingEnabled = false`.
4. **Redraw only when something changes**, about 4 times a second (same rhythm as the HTML read-out), never every frame.
5. **Phones:** 3 meshes and 3 materials is fine. If frame rate suffers, put the three canvases in one texture. Report what you measured.
6. **HTML read-out:** keep it for Orbit view. In Cockpit view, ask Andy (after he has seen the screens) whether the HTML read-out should hide. Default until he answers: it stays.
7. Tests for the pure parts (what text and numbers go on each screen for a given flight state, including missing fuel info). `npm run check` must pass.
8. Deliver by pushing to main if you have GitHub access, otherwise a zip of only changed files plus the report.

## Not allowed
src/render/assets, src/game, src/universe, src/save, other src/ui files.

## Andy checks (after a green Actions run)
Play trips (`?speed=600`), Cockpit view: readable at the game's pixel size on desktop and phone, countdown and fuel change during the trip, the map ship moves, a tour shows its stops, all three ships. One screen at a time if he wants changes. Andy answers on the HTML read-out question.
