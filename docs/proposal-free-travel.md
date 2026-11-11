# Proposal: Free travel (no job needed). Status: APPROVED by Andy 2026-11-11 (answers below); stage F1 brief written

## Andy's decisions so far (2026-11-11)
- Free flight is allowed, as menu travel: pick a place, pay fuel, watch the warp. No steering.
- Combat never. Calm, child-friendly, stress-releasing.
- Wants to be able to explore if he has fuel and credits, e.g. when stuck at a dock with no jobs.

## Proposed rules (Lead, to confirm)
1. Where: any dock within fuel range (same docks as jobs). No cargo and no passengers; the trip costs fuel only. Trip time and warp animation as for jobs.
2. Where there is no dock: you can also "visit" a place with no dock (a scenery planet, or empty deep space between stars). You arrive in space (system view / cockpit looking out), nothing to do there but look, take screenshots-in-your-head, and read a funny line. Then you choose where to go next; leaving costs fuel as normal. You cannot refuel there, so the game must warn before you go: "fuel left on arrival: X".
3. Safety: the game never lets you start a trip that would strand you with fuel too low to reach any dock (the trip button shows "not enough fuel to come back" and the player can still force it only if Andy wants a risky mode: not proposed). The existing free emergency refuel stays as the last net.
4. Where it lives in the UI: the system view and the map get a "Fly here (fuel N)" button on any dock or scenery planet. Jobs menu is unchanged.
5. Game rules (Agent 4): a travel without a job; fuel cost = same formula; no pay, no rank progress; maybe a funny debrief line. State: current position can be a dock OR "in space at X" (a new location kind). Save needs a new field with a default.
6. Render (Agent 3): reuse the warp and arrival; arrival at a dock-less place shows the system view or open space without a docked scene.
7. Out of scope: steering, collisions, combat, anything dangerous, running out of fuel in deep space with no way home beyond the emergency refuel.

## Questions for Andy
- Q1: Is "in space at a scenery planet" enough, or do you want true empty space between stars?
- Q2: Should free travel pay anything (discovery credits for visiting a system for the first time)? Suggestion only; would reward exploring.
- Q3: Do you want a "stranded" safety rule as in 3?

## Stages (after approval)
F1 Agent 4: game rules, location kind, save field, tests. F2 Agents 3/5: map and system-view button, arrival in space, wording. F3 Agent 6: QA and balance (fuel).


## ANDY'S ANSWERS (2026-11-11)
- Q1: fly to scenery planets, and visit outposts/stations WITHOUT a job. No true empty deep space between stars (not built).
- Q2: YES discovery credits: 50 to 100 for the first visit to a system. NEW RANK "Explorer" that counts unique systems explored and unique planets flown to.
- Q3: OK, strand protection on (a trip that would leave too little fuel to reach any dock is refused; emergency refuel stays).

## Lead decisions to fit the answers (Andy can change)
- Discovery credits: each system pays once, on the first arrival, an amount of 50 to 100 chosen deterministically from seed + system id (same every time). Planets pay nothing; they only count for the rank.
- "Explored" counts ANY arrival (free travel or job), so jobs also explore. Planets "flown to" counts docks and scenery planets arrived at.
- Explorer is the 4th rank category (the old rule was max 3 ranks, changed by Andy now). 3 levels like the others. Proposed thresholds are for Agent 4 to propose with data; Andy decides. Rank reward: bigger discovery credits (+0/10/20%) rather than job pay, so it only helps explorers. Pay-bonus stacking rule for jobs is unchanged.
- Save: new fields with defaults: visited system ids, visited planet ids (lists). Old saves start empty. Cap or compact if they grow big; Agent 4 decides and reports.
- Arriving at a scenery planet: you stay in space at that planet (no dock). Next destination is chosen from there; fuel for the next leg is counted from that planet.
