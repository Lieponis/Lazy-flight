# Agent 3 brief, stage C2c: tour stops on the cockpit screens

You are Agent 3 (rendering). Work on the CURRENT `main`. Read docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-3-c2b.md (sections 4.3, 7, 9) and docs/cockpit-design-brief.md first. One step at a time with Andy. The only report is docs/report-agent-3-c2c.md. Cockpit is a view only.

## Goal
Tours show their stops: Andy's cockpit design asked for "next stop" on the info screen and the stops on the route map. Tours fly straight to the last stop; the intermediate stops are flavour, shown as dots/names.

## Do
1. Add an optional `stops` list (stop names, in order, final destination last) to `FlightInfo`. Fill it in the glue in `src/ui/index.ts` from `job.stops` (the ONLY ui change allowed). Flights without stops (trade, passenger) behave exactly as now.
2. Map screen: stop dots on the route line at their fair positions along the route (by distance if the data has it, otherwise evenly spaced), the ship marker passes them.
3. Info screen: for tours show "NEXT: <stop name>" (the next stop not yet passed, by trip progress), keeping the one-text-size rule and the 15 s / 10 s funny-line rhythm.
4. Tests for the pure parts in tests/screendata.test.ts style (next stop by progress, no stops, one stop, many stops, long names cut cleanly).
5. `npm run check` must pass. Push to main if you have GitHub access.

## Not allowed
src/render/assets, src/game, src/universe, src/save, other src/ui files.

## Andy checks (after a green Actions run)
Take a tour (Passenger Liner; `?speed=600`), Cockpit view: stop dots on the map, next stop on the info screen changes as the ship passes them; a trade job looks as before.
