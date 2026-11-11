# Proposal: Free travel (no job needed). Status: DRAFT, waiting for Andy

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
