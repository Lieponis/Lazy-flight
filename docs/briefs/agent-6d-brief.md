# Agent 6 brief, stage U4 (part 6d): rebalance and QA on universe v2

You are Agent 6 (Save / QA / Balance). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-fewer-docks.md, docs/report-agent-2b.md, docs/report-agent-4e.md, docs/report-agent-3f.md, docs/report-agent-5e.md, docs/report-agent-6c.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Report: docs/report-agent-6d.md. Tell the Lead BEFORE changing any game number; Andy decides. Free flight and combat are permanently out.

## Part A: balance on the new universe (about 3x fewer docks)
1. Run `npm run balance` on universe v2 over at least 30 seeds. Report per player type (planner, sensible, spender, casual, lazy): hours to first ship, first outpost, first upgrade level, full track; credits per hour; whether credits pile up unused at 30 h. Compare with the 6c numbers on universe v1 (first outpost: planner 9.1 h on v1, 11.1 h on v2; casual and lazy never reach one on v2).
2. Outposts: Agent 4 measured cheapest 5,000 to 10,200 and median 22,000 to 27,000. Propose (do not apply) options if casual players never reach an outpost, e.g. cheaper range or lower minimum price. Give numbers for each option.
3. Starter job: seed 1 has a dead first board in a one-dock start system (0 of 6 jobs takeable for a new Hauler); 20 of 300 seeds have no takeable first job. Propose how to guarantee one takeable starter job on the first board (choose the least invasive, must stay deterministic, must not change the universe layer if avoidable; if it needs src/universe, tell the Lead). Andy decides before you build it.

## Part B: QA
1. Fix the flaky test `tests/universe-v2.test.ts` ("first dock of the system nearest to the middle", times out at 5 s on Actions): longer time limit or a faster check. Fix the 1 failing audio test that already failed before universe v2 (find out why; fix the cause, do not weaken).
2. Old saves: test a real v1 save (Andy can send one from his phone via the debug page) migrates correctly, the message shows once, nothing breaks after reload. Save/load in every state: upgrades, outposts with stored prices, sound settings, several ships.
3. Regression pass at phone and desktop sizes with the headless browser across all screens (title, system view with 1 and 10 planets, map, docked, flight, Jobs, Shipyard, cockpit). Add a regression test for every bug found.
4. Performance: report real triangle counts for a 10-planet, 3-dock system (the `?systempreview=1` TRIS counter). ONE short phone checklist for Andy (frame rate in system view, docked view, cockpit; sound on first tap; Safari private tab). Ask Andy if he can borrow an Android phone.
5. Note for testers: `?seed=` replaces the saved game; tell Andy to use a private tab.

## Allowed / not allowed
Allowed: tests (including tests/sim), src/game and src/save only for approved fixes, docs. Not allowed: new features, art, anything Andy decided, game-number changes without Andy.

## Andy checks
Reads your short balance table and options, picks one for outposts and the starter job. Then clicks through a new game and an old save on his phone.
