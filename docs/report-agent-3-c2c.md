# Report: Agent 3, stage C2c (tour stops on the cockpit screens)

**1. What was built.** Tours show their stops in the cockpit.
- **Map screen:** the stops before the destination are rings on the route line, spaced evenly (the game only gives the total distance, not leg lengths). A ring fills in bright once the ship has passed it. Ordinary jobs show no rings.
- **Info screen (status page):** for tours the heading is "NEXT STOP n/total" (or "FINAL STOP n/total" for the last one) with the stop's name (up to two lines), and the countdown label reads "TOUR ENDS IN". Same text size, same line count, same 15 s status / 10 s funny-line rhythm as before. After arrival the facts return to the normal layout. Trade and passenger jobs (one stop) look exactly as before.
- `FlightInfo` has a new optional `stops?: string[]` (names in order, final destination last; none or one = not a tour). The game flies tours straight to the last stop, so the "next stop" is worked out from the trip progress: stop i of n counts as passed at i/n of the trip.
- Files: `src/render/screendata.ts`, `src/render/cockpitscreens.ts`, `src/render/flight.ts`, `src/render/flightplan.ts`, `src/ui/index.ts` (one line: `stops: job.stops.map(dockName)`), `tests/screendata.test.ts`. Nothing in `src/render/assets`, `src/game`, `src/universe`, `src/save`.

**2. How to check.** Green Actions run; Passenger Liner (`?speed=600`), take a tour, Cockpit view: rings on the map fill in as the ship passes them, "NEXT STOP" changes; a trade job looks as before.

**3. Live link.** https://lieponis.github.io/Lazy-flight/

**4. Known issues / not verified.**
- I could not run `npm run check` or Three.js (no network for installs): type check against a stand-in and tests with a stand-in runner. Real proof = green Actions run + Andy's click-test. Andy checked a tour in the cockpit ("Good").
- Not verified: phone frame rate; every tour length (the info page stays readable at three stops; very long names are cut to two lines).
- Stops are evenly spaced, not by real distance: the ship's real route is one straight flight, so the dots are flavour only.

**5. Cost.** Nothing measurable added: two small rectangles per stop drawn on a canvas that is redrawn about 4 times a second in Cockpit view.

**6. Settings.** None new. Layout and wording in `cockpitscreens.ts`; stop maths in `screendata.ts`.

**7. For the next stages.** If tours ever fly stop by stop, `FlightInfo.stops` is already there; the screens then only need the real per-leg progress in place of the even spacing.

**8. Suggestions (not built).** A short blink or message when a stop is passed ("Passing Beta Outpost"); stop names in the funny-message rhythm.
