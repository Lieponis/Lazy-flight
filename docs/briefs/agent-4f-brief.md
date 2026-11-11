# Agent 4 brief, stage F1: free travel and the Explorer rank (game rules and save)

You are Agent 4 (Gameplay). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-free-travel.md (Andy's answers and Lead decisions: source of truth), docs/report-agent-4e.md, docs/report-agent-4d.md, docs/report-agent-4c.md (ranks), docs/report-agent-6a.md (saving). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Report: docs/report-agent-4f.md. Combat and weapons never; steering the ship is not part of this. Tell the Lead BEFORE choosing any game number that Andy has not given; Andy decides.

## Goal
Add "free travel": the player can fly to any dock within fuel range or to a scenery planet (a planet without a dock) in a system without taking a job, paying fuel only. Add discovery credits and a 4th rank, Explorer. Game logic and save only (no new screens: Agents 3/5 do those in F2).

## Do
1. Location kinds: the player is "docked at X" or "at a scenery planet P" (in space). The state has a location that can be either (new field with a default; old saves stay docked). From a scenery planet you cannot take jobs, buy or refuel (the debrief says so in a funny line); the only things to do are travel again, or switch ship / use emergency refuel.
2. `game.canFreeTravel(targetId)` / `game.freeTravel(targetId)` (names yours): target is a dock id or a scenery planet id; same fuel cost formula as jobs; no cargo, no pay, no job rank progress; failure reasons in plain text ("Not enough fuel"). Same-system trips are allowed. Time passes as for a job of the same length.
3. Strand protection: refuse a trip if after it the ship could not reach any dock with its remaining fuel (the check must be cheap and deterministic: use the nearest dock to the target). Message in plain text with the fuel numbers. The free emergency refuel stays the last net and must work from a scenery planet too.
4. Discovery credits: on the FIRST arrival in a system (by free travel or by a job), pay a deterministic amount 50 to 100 credits chosen from seed + system id; once per system, ever. Explorer rank can raise it (+0/10/20% proposed). Put the numbers in `settings.ts`.
5. Explorer rank (4th category beside cargo, passengers, tours): counts unique systems explored and unique planets arrived at. Propose three thresholds with data from the balance simulator (teach the sim an explorer player type or a simple model) and send them to the Lead BEFORE building; Andy decides. The job pay bonuses and the stacking rule (top +50%) stay unchanged.
6. State/save: new fields with defaults in `normalizeState`: location kind, visited system ids, visited planet ids (lists), explorer rank. Old saves load with empty lists. `SAVE_VERSION` handling as in 6a; `lazy-freight.*` keys stay. If the lists could grow large, say how you keep the save small (e.g. cap or compact) and test it. Universe v2 migration still works.
7. Tests: free travel to a dock and to a scenery planet; fuel and strand rules; emergency refuel from a scenery planet; discovery credits once per system and deterministic; rank thresholds; old save loads; jobs still work exactly as before; no jobs from a scenery planet; a one-dock system works.
8. `/game-debug.html`: buttons for the new things (travel to a dock, to a planet, show explored counts) so Andy can test before F2.
9. `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/game, src/save, tests (including tests/sim), /game-debug.html, docs; the smallest glue in src/ui/index.ts only if the build needs it to compile (say so). Not allowed: new screens, render, new art, changing anything Andy decided, changing job pay numbers.

## Andy checks
On `/game-debug.html`: fly to a dock without a job and pay fuel; fly to a scenery planet; discovery credits appear once; trying to strand yourself is refused; emergency refuel works from a planet; reload keeps everything; counts of explored systems and planets rise.
