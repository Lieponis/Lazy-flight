# Report: Agent 3, stage C2b (trip information on the cockpit screens)

**1. What was built.** The cockpit's screens now show the trip.
- **Info (straight ahead, dark background):** destination, arrival countdown, phase (LAUNCH / WARP / APPROACH / ARRIVED). Every 15 s the page changes for 10 s to a funny ship-computer line (the existing `COMPUTER_LINES`), then back. The arrival always shows the facts. All text on this screen has one size, so nothing overlaps.
- **Map (middle, same dark background):** origin square, destination ring, bright path where the ship has been, dim path still to go, yellow ship marker moving along the route, a few stars (fixed per trip).
- **Fuel (amber, left wing):** bar and number draining from fuel-at-take-off down to fuel-at-arrival. Dashes if the game gave no fuel info.
- **Right wing screen:** amber with a few quiet bars (Andy's wish, to match the left wing). See issue 4.2.
- All pictures are 192 px wide (2x), smooth (mipmapped, linear), with thin outlined text. Redrawn about 4 times a second, only in Cockpit view (and at once when the cockpit appears or the pixel font finishes loading). The right wing picture is drawn once.
- In Cockpit view the HTML text box and "FLIGHT" title are hidden (the progress bar and the Orbit button stay). Orbit view is unchanged except that its text box, title and button now use the game's pixel font (`--ui-font`, VT323) at bigger sizes.
- Fuel in the flight info: `FlightInfo` has optional `fuel` (left, trip already paid), `fuelMax`, `fuelUsed` (what the trip burns). Filled in by the glue in `src/ui/index.ts` (the only ui change).
- Files: `src/render/screendata.ts` (pure), `src/render/cockpitscreens.ts` (drawing), `src/render/flight.ts`, `flightplan.ts`, `flight.css`, `settings.ts`, `src/ui/index.ts` (fuel glue), `tests/screendata.test.ts`. Nothing in `src/render/assets`, `src/game`, `src/universe`, `src/save`.

**2. How to check.** Green Actions run, then `?speed=600`, take a trip, Cockpit view: countdown ticks, fuel drains, the map ship moves, a funny line shows for 10 s every 15 s. Orbit view: pixel-font status box.

**3. Live link.** https://lieponis.github.io/Lazy-flight/

**4. Known issues / not verified.**
1. I could not run `npm run check` or Three.js (no network for installs). Type check was against a stand-in and the new tests ran with a stand-in runner; the real proof is the green Actions run and Andy's click-test. Andy checked it on a phone and on desktop (screenshots); NOT confirmed one by one: all three ships, phone frame rate (not measured).
2. The right wing screen has no anchor in Agent 8's cockpit. I place my picture on the fuel anchor mirrored across the cockpit's middle line, which I hard-coded as 0.6 crates from the eye (`COCKPIT_CENTRE_X` in `cockpitscreens.ts`; Agent 8's `EYE.x` is -0.6). It covers the made-up readout Agent 8 drew there. If the cockpit model changes, this must be updated. Request to Agent 8 (not edited): add a `screenRightWing` anchor.
3. Tours: the flight info has no stops, and the brief allowed only fuel glue, so the screens show the final destination only (no next stop, no stop dots on the map).
4. Text is limited by the game's small picture: zoomed far out (zoom-out limit) the screens are too small to read. Readable at the start view and when zooming in a little.
5. The info page can show a long destination on two lines at most; the rest is cut.

**5. Cost.** 4 more small meshes (planes), 4 materials, 4 textures (192 x about 220, mipmapped). Redraw about 4 times a second in Cockpit view only; nothing in Orbit view. Not measured on a phone.

**6. Settings** (`src/render/settings.ts`). `COCKPIT_STATUS_SECONDS` 15, `COCKPIT_MESSAGE_SECONDS` 10. Colours and layout in `cockpitscreens.ts`; texts in `screendata.ts`; funny lines in `flightlines.ts`.

**7. For the next stages.**
- Agent 3 later (3e pixel look): the screens' colours and text are in `cockpitscreens.ts`.
- Agent 8: `screenRightWing` anchor (see 4.2); more screens could carry data if given anchors.
- Agent 5/6: tour stops need to reach `FlightInfo` (a `stops` list of names) if the map should show them. The game state already has `job.stops`.

**8. Andy's decisions in this stage.** HTML read-out hides in Cockpit view (Andy: the funny messages in the cockpit replace the status window). Status 15 s / message 10 s. Info and route screens share one dark background. Right wing screen amber.

**9. Suggestions (not built).** Tour stops on the map and info screen; a blinking "arriving" cue near the end; the console screen showing the credits; move the funny line to its own screen once Agent 8 adds an anchor.
