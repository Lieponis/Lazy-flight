# Lazy Freight (working title): Design Doc v3 (APPROVED by Andy, 2026-11-06)

## Vision
A relaxing, funny, PS1-style space game. You run a small ship through an endless generated galaxy, taking jobs from inside a chunky low-poly cockpit. Long trips run in the background, so you can leave the tab and come back to your pay.

## Core loop (every 5 minutes)
1. Open the mission board at a station or outpost.
2. Pick a job and press **Fly**. The ship leaves the dock.
3. Warp loop, lasting as long as the trip. Player can switch **Orbit / Cockpit** view.
4. If the tab is open near the end: approach animation to planet and dock.
5. Funny debrief, get paid, spend credits, pick the next job.

## Main screens
1. **Cockpit Home**: system view through the window; panels for credits, fuel, current job.
2. **Mission Board**: reward, distance, load, funny blurb.
3. **Starmap**: nearby stars only, limited by fuel range.
4. **Flight View**: warp loop, progress bar, ETA, Orbit/Cockpit switch, approach animation.
5. **Shipyard & Ranks**: ships, upgrades, ranks, outposts.

## Procedural universe rules
One seed + coordinates computes everything. Nothing is stored except player progress.
- Seed controls: systems, planets, docks, goods, prices, jobs, all names and jokes.
- **Every planet has either a surface outpost or an orbiting station.** Both have a mission board. Same generator for both.
- Layers: galaxy > system > planet > dock > jobs. Each layer only uses the ones before it.
- Saved in browser: credits, ship, ranks, current job (start and end time), list of owned outposts, seed.

## Mission system
One job pattern: load, go, deliver, get paid.
- A job has: load type (goods or passengers), amount, destination, optional time limit, reward.
- Passengers are just a load type. They need a passenger cabin instead of a cargo bay.
- Tours = passenger job with 2-3 stops.
- Trade = buy goods here, sell there, using local prices.
- Scanning and rescue (later phase) use the same pattern: the "load" is a scan result or survivors, destination is a generated spot or abandoned station.
- Fuel cost scales with distance. **Max trip length: 4 hours.** Arrival is computed from saved start/end timestamps, so closing the tab is fine.

## Progression
- Credits, 3 ranks (Trader, Explorer, Hauler), 3 ship classes (Cargo Hauler, Passenger Liner, Scout), upgrades.
- **Outposts are optional.** The player chooses whether to buy one; its missions work either way. Owned outposts are a saved list/count and a home base.
- **Outpost perks (v1):** cheaper fuel and a small passive income. Kept to two numbers, nothing more.

## Art direction
- About 320x180 render, scaled up with no smoothing (nearest-neighbor).
- Grainy dithering, limited palette, small PS1 vertex wobble.
- Near-black space, bold saturated planet colors.
- Free assets: Kenney and Quaternius (CC0) for ships/stations, open-license pixel font, Kenney sounds.

## OUT OF SCOPE
- **Permanently out: free flight and combat. Never at any stage.**
- Out for v1: planet landing, multiplayer, voxel terrain, accounts/servers, monetization, more than 3 ships and 3 ranks, full-galaxy map.

## First playable milestone
Starmap: pick a destination, accept a trade job, watch the ship leave and warp, get paid.

## Phases for missions
1. Trade. 2. Passengers and tours. 3. Scanning and rescue.

## Top 5 risks and fixes (approved)
1. Scope: one job pattern; trade first, others as variations.
2. Endless map unreadable: nearby stars only.
3. Phone performance: low resolution, real-phone test by Agent 6.
4. Background tabs pause timers: save start/end times.
5. Economy balance: Agent 6 balance pass plus Andy's fun check.

## Hand-offs
- **Agent 1 (Setup):** Vite + TypeScript + Three.js, 320x180 nearest-neighbor, live pixelated cube, test runner, plain-language README.
- **Agent 2 (Universe):** deterministic generator with tests (systems, planets, outpost-or-station per planet, goods, prices, jobs, names, joke tables).
- **Agent 3 (Rendering):** cockpit frame, system view, starmap, launch, warp loop, Orbit/Cockpit switch, approach animation. Keep light for phones.
- **Agent 4 (Gameplay):** one job engine, fuel, timestamp travel (4h max), credits, ranks, outpost purchase and perks.
- **Agent 5 (UI):** the five screens, retro font, touch + mouse controls, readable at small sizes.

## Appendix: Andy's confirmed answers
Cockpit is the menu at stations/outposts. After launch, switch Orbit/Cockpit. Player can stay or close the tab during flight. Approach animation near the end if the tab is open. Tone: relaxing, idle, funny.
