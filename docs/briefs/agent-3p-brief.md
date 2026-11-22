# Agent 3p brief: the sky must not jump when the ship lands (Andy 2026-11-22)

Build on CURRENT main. One step at a time with Andy (Step N of M / DO max 3 / LOOK FOR / REPLY WITH). Lean. Never touch save data. Tests stay green. Suggestions labelled "suggestion".

## Problem (Andy)
After 3o fix 3 the sky in flight and warp is turned to match the trip. When the ship lands or docks, the background switches to another direction. It should stay exactly as it was at the end of the flight.

## Lead's finding
In flight the sky is turned by headingQuaternion(tripDirection(origin, destination)) (flight.ts ~783, src/render/skyheading.ts). The docked screens (docked.ts enter() -> sky.setPosition) and the floating-at-a-planet view use the old fixed, unturned sky, so it snaps at arrival. Same snap may happen at launch (docked fixed sky -> new trip sky).

## Wanted
1. Landing/docking and floating after arrival: keep the SAME sky turn as the end of the trip, for as long as the player stays in that system (docked, floating, system view backdrop). No snap, no fade needed.
2. Launch: the sky at the start of the next trip should start from what the player saw while docked, then turn smoothly to the new trip direction during the launch (A: smooth turn over the launch phase, B: keep the docked sky for the whole trip, C: today's snap). Show Andy A/B, he picks. Default if he does not care: A.
3. Page reload or first start (no trip in memory): use the default unturned sky as today. Suggestion (do NOT build unless Andy says yes): remember the last trip's heading in the save so reload also matches.
4. Same-system hops and tiny hops (MIN_TRIP_LY) keep their sky as now.

## Check
A test that the sky turn used when docked right after a trip equals the turn at the end of that trip, and that a hop with no direction leaves the current turn unchanged. Andy's eye test: fly one real trip toward the centre, land, look around the docked view: the centre should still be where it was when the ship arrived.

## REPLY WITH (max 8 lines)
What changed, live link, what Andy should look at, and which launch option he picked.
