# Agent 3 report, stage "3o": outposts off the ice pole, the station goes round its planet, the sky follows the trip

Live build: https://lieponis.github.io/Lazy-flight/ (main, CI green on `bac1357`). Andy looked at all three on his iPhone and answered "Matches" each time (fix 2 after one redo; he picked speed A).

## 1. Outposts no longer stand on the ice pole
- **What:** the outpost's pad is put on an ordinary spot of every planet type: within about 30 degrees of the equator, never inside a cap. Earth-like planets still get a coast first. Same planet, same spot (no randomness).
- **Before / after (Andy's screenshots):** pad on a cap 26 of 33 (ICE) and 8 of 15 (OCEAN); now 0.
- **Files:** `planetlook.ts` (`outpostSpot`, `coastSpot(.., maxLat)`), `systemview.ts` (uses it), `planets.ts` (`planets.html?type=ICE&ground=1` shows old beside new).
- **Side effect:** the pad spot of Earth-like outposts moved (still a coast).

## 2. The station goes round its planet (docked at a station)
- **What:** seen from the bay, the station stands still and the outside turns round it: planet, its light, the stars and the faint galaxy sky turn together about the sideways line. The ground flows along the slot, towards you. One trip round takes **300 s (speed A, Andy's pick)**; B 150 s and C 60 s with `?orbit=B|C`, `?orbit=off` stops it.
- **Day and night:** the sun is fixed in the outside, so each trip has a day half and a night half (night is dim, not black). Every visit starts in daylight (within 40 degrees of noon).
- **Caps:** the path is tilted 25 degrees from the equator, so the ground below never goes above 25 degrees of latitude; with the view reaching about 22 degrees more, even the lowest caps (they start at about 49 degrees) stay out of the opening. A test checks this.
- **Launch:** leaving a station shows the planet as the docked view left it (it does not turn during the launch). Arriving starts a new visit at its start place.
- **How:** `stationspin.ts` (pure numbers), `stationworld.ts` (the ball: tilted pole, the light baked in the ball's own frame, the whole group turns), `docked.ts` (turns planet, backdrop stars and the sky), `flight.ts` (same planet), `galaxy/skyview.ts` (`setTurn`). The sky is shared with other screens, so docked gives it back unturned on exit.
- **Dropped:** "clouds a touch faster". The light is baked into the clouds, so letting them slide past the ground would put bright clouds on the dark side. Not cheap, so not done.
- **Known look:** gas giants have stripes parallel to the equator, so they flow past as bands; fine on the tilted path.
- **Testing aid (look only):** `?stationdemo=1` shows a station bay instead of the start outpost (the start dock of the world seed is an outpost). Only the picture changes; ship, game state and save stay as they are.

## 3. The faint sky ahead matches the real direction of the trip
- **What:** on a trip, what lies ahead of the ship is what lies from the system you left towards the system you go to: the centre ahead when flying inward, the rim ahead when flying outward; behind is where you came from. The disc stays level on trips along it. The same trip gives the same picture. Docked and floating views keep their sky; a hop inside one system (or under 0.5 ly) keeps the old sky. Warp uses the same rule (ahead = destination side, behind = origin side); the warp streaks themselves are unchanged.
- **How:** `skyheading.ts` (pure: trip direction and the turn), `skyview.ts` (`setSkyFrame`), `flight.ts` (`pointSkyFrame` on `begin`; set on `enter`, given back on `exit`).
- **Testing aid:** `?warppreview=1&heading=in` or `heading=out` runs a real trip to the nearby system that lies most towards the centre or the rim (title says which).

## Tests (new: 36)
`outpostspot` 7, `stationspin` 12, `stationworld` 6, `skyheading` 11. They cover: no pad on a cap for any type; same planet same spot; pole path and cap clearance; start in daylight; the turn never jumps; the ground flows along the slot (z), not sideways (x); the nose ends up pointing along the trip for 400 trips; centre trip and rim trip give opposite skies ahead; a short hop is steady (under 1 degree for a small nudge); and with the real galaxy the glow toward the centre is brighter than toward the rim. CI is the real check: this workspace has no real three.js or vitest, so I ran the pure parts with a small stand-in and type-checked.

## Known issues and limits
- Seen only through Andy's screenshots and answers, never on a real screen myself.
- About half of each trip round has the sun down (about 40 percent is the darkest shade), by geometry: at speed A that is about 2 minutes of dim ground. `STATION_SUN_ABOVE_ORBIT_DEG` only changes how bright the day is; a shorter night would need a different orbit design (for example a dawn-dusk path with the sun beside the path), which is a suggestion, not done.
- The faint sky is faint: during a warp the streaks can hide it, so the heading is clearest in the cockpit view.
- The planet at a station stands still during the launch and the arrival (only the docked view turns).
- Not checked by Andy: a real mission trip (only the two preview trips); it uses the same code.

## For the next agent
- Testing words (Safari only; the home-screen app cannot take them): `?stationdemo=1`, `?orbit=A|B|C|off`, `?warppreview=1&heading=in|out`. None of them touch the save. Never use `?dev=1&seed=N` on the phone (it replaces the save).
- The station planet is one function (`makeStationWorld`) used by docked and flight; change the tilt, sun height or start spread in `settings.ts` (`STATION_*`).
