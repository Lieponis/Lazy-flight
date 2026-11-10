# Report: Agent 3, stage C2a (new cockpit in the flight view)

**1. What was built.** Cockpit view now shows Agent 8's base cockpit (one for all ships) instead of the flat overlay.
- The room sits in a holder (`cockpitRig`) at the pilot's eye; it is NOT a child of the camera, so the room stays level while the view tilts and shakes. Hidden in Orbit view. Lights flash every frame (`update(clockT)`).
- Drawn through Agent 8's lens (`FlightScreen.render`, optional `render(renderer)` on `Screen`, called from `index.ts`). Orbit view draws as before. Your own ship is never drawn from inside.
- Andy's additions during testing (labelled, not in the brief): shake in the cockpit is 20% of the orbit shake; drag looks around (limits 110 deg sideways, -40/+55 deg up/down); wheel or pinch zooms 5x in and 5x out; double tap/click glides back to the start view; the start view is the approved 70 deg zoomed out 1.75x (about 102 deg), widest 150 deg.
- Pure logic in `src/render/cockpitview.ts`, tests in `tests/cockpitview.test.ts`. Other files touched: `flight.ts`, `index.ts`, `screen.ts`, `settings.ts`. Nothing in `src/render/assets`, `src/game`, `src/ui`, `src/universe`, `src/save`.

**2. How to check.** Green Actions run, then: `?speed=600`, take a trip, press Cockpit view. Test `?ship=scout` and `?ship=passenger-liner`. Drag, pinch/wheel, double tap.

**3. Live link.** https://lieponis.github.io/Lazy-flight/

**4. Known issues / not verified.** I could not run `npm run check` or Three.js (no network for installs); I only type-checked against a stand-in and ran the new tests with a stand-in runner. Real proof = green Actions run + Andy's click-test. Verified by Andy on desktop: look, shake, drag, zoom, double-tap glide. NOT verified: phone frame rate, phone upright/sideways, the other two ships, HalfFloat render target on older phones (the lens needs it; same as the viewer). `FlightScreen.dispose()` exists (frees lens and cockpit) but nothing calls it: the flight screen lives for the whole game, so there is no leak over many flights. Andy's wish "outside smaller, cockpit unchanged" needs a two-layer draw (lens.ts change, Agent 8 / Lead); the zoomed-out start view was used instead.

**5. Cost.** Cockpit ~2,400 triangles, 4 meshes, 1 material = +4 draw calls. Removed the old overlay (about 9 boxes, 9 draw calls). The lens adds one extra pass: the whole scene is first drawn into a hidden picture (130% of the screen height, wider at wide views), then one 2-triangle quad. Expect the cost of drawing the scene about 1.3-2x in cockpit view, still at the tiny 320x180-class size. Not measured on a phone.

**6. Settings** (`src/render/settings.ts`). `COCKPIT_SHAKE_FACTOR` 0.2; `COCKPIT_LOOK_*`; `COCKPIT_DEFAULT_ZOOM_OUT` 1.75; `COCKPIT_ZOOM_RANGE` 5; `COCKPIT_FOV_CAP` 150. Lens: `COCKPIT_FOV` 70, `COCKPIT_LENS` 0.35 (assets/lens.ts, unchanged).

**7. Phone checklist for Andy.** Open `?speed=600` (also `&ship=scout`, `&ship=passenger-liner`). Start a trip, Cockpit view, phone upright then sideways. Look for: no stretched edges, space through the window, no own ship, lights flash, smooth. Try drag, pinch, double tap. Report: phone model, which ship, upright or sideways, a screenshot, and "smooth" or "stutters".

**8. For the Lead / next stages.**
- `src/render/cockpit.ts` (old overlay) is no longer used and is WAITING for Andy's approval to be removed in a follow-up.
- C2b: put the trip read-out on the three screens (anchors `screenInfo`, `screenMap`, `screenFuel`; the cockpit model is `cockpitModel` in `flight.ts`). The HTML read-out stays for now.
- Per-ship cockpits, dog, lamp, window light: deferred by Andy, not built.

**9. Suggestions (not built).** Throttle lever moving with the trip; a "Reset view" button for people who do not find double tap; remember zoom between flights.
