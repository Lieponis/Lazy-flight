# Agent 3 report, stage "3p": the sky turn stays when the ship lands

Live build: https://lieponis.github.io/Lazy-flight/ (main, CI green on `3p: the sky turn stays when the ship lands`). Andy checked the landing on his iPhone ("Matches") and picked take-off option **A**.

## What changed
- **Landing keeps the sky.** At the end of a trip the sky turn is remembered for the system the ship arrived in. The docked view there and floating at a planet use exactly that turn, for as long as the player stays in that system. Nothing snaps.
- **Take-off starts from it.** The next trip starts from the sky the player had while docked (station: including the turn of the station round its planet) and, with **A (Andy's pick, the default)**, turns smoothly to the new trip's direction during the launch (smoothstep over the launch phase). B (keep the docked sky for the whole trip) and C (jump, the old way) are still there as `?skylaunch=B|C`. Note: B means the sky never turns to the trip's direction (it switches the matching sky of 3o fix 3 off), so only A is recommended.
- **No direction, no change.** A trip with no direction (same system, under 0.5 ly) leaves the turn exactly as it was, at take-off and on landing.
- **Reload or first start:** nothing is remembered, so the default unturned sky is used, as before. Suggestion (not built, as the brief says): remember the last trip's heading in the save so a reload also matches.
- **Why it is exact:** at take-off and at the end of a landing the dock group stands straight (no turn), so the sky turn can be handed between the flight scene and the docked scene as it is. A CI test checks this for stations and outposts.

## How
- `skyheading.ts` (pure): `SkyMemory` (the turn kept per system), `tripSkyAt` (start turn, trip turn, option, launch progress), small turn maths (`slerpQuat`, `multiplyQuat`, `angleBetween`), `parseLaunchMode`.
- `flight.ts`: remembers the turn at the end of a trip (`leave()`), starts from the docked turn or the kept one (`begin(info, orbitStartSeconds, dockedSky)`), turns the sky during the launch for A, and floating (`beginFloat`) uses the kept turn.
- `docked.ts`: starts from the kept turn and adds the station's own turn on top (`currentSkyFrame` hands the current sky to the launch). `galaxy/skyview.ts`: `setTurn` removed; `setSkyFrame` is the only way now.
- `index.ts`: one `SkyMemory` for both screens. Not touched: `src/universe`, `src/game`, `src/save`, saves.

## Testing aid (Safari only)
`?skytrip=1` shows TEST TRIP IN / TEST TRIP OUT: a pretend 40 second trip from the dock you are in to a real nearby system towards the centre or the rim, ending docked there. `?skylaunch=A|B|C` picks the take-off option. Look only: nothing is saved; reload to go back. Never use `?dev=1&seed=N` on the phone.

## Tests (new: 16, two files adjusted)
`skymemory` 11 (pure: no direction leaves the turn unchanged for every option; A starts at the docked sky, turns without a jump, ends at the trip's sky; docked right after a trip equals the end of the trip; another system gets the default sky; the centre stays where it was), `skymemorywiring` 5 (the dock stands straight at take-off and landing; the screens and the app use the memory), `skyheading` and `stationworld` tests adjusted to the new calls. CI is the real check: this workspace has no real three.js or vitest (pure parts run with a stand-in, types checked).

## Known issues and limits
- Seen only through Andy's answers, never on a real screen myself.
- The **system view** keeps its own sky (it shows a star picked on the map, not the one you are in), so it is not turned by the trip. Suggestion: only if Andy wants it.
- The 3D backdrop dots (the star points) are not tied to the trip direction; only the faint galaxy sky is.
- Andy checked the landing with a pretend test trip and picked A after trying the options; a real mission trip was not checked (it uses the same code). He answered "A" without a separate "matches" for the take-off.
