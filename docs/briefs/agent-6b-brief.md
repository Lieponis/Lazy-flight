# Agent 6 brief, part 6b: QA and balance pass

You are Agent 6 (Save / QA / Balance), part 6b. Work on the CURRENT `main` (never an old zip). Read docs/design-doc.md, docs/CONVENTIONS.md, docs/status.md and ALL reports (1, 2, 3a-3d, 4a-4c, 5a-5c, 6a, 8, 8-fix). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-6b.md (a short bug and balance report for Andy). Free flight and combat are permanently out.

## Do
1. **Balance by simulation, not guessing.** Write a test-only script (tests or a dev page, not shipped in the game) that plays many automatic sessions with sensible and lazy strategies on several seeds, using the real `src/game` rules, and reports: credits per real hour at `speed=1`, time to first ship (1200 to 1500 cr), to first outpost (5,100 to 39,800 cr), to each rank, how many jobs get blocked by fuel, cargo, cabin or rank, how often the player is "stuck". Targets from the design doc: relaxed, no stress, a session of 10 to 20 minutes picks up a job and watches the flight; a first ship should take roughly an hour or two of play, a first outpost several hours (state your proposed numbers and why). Report findings with tables; propose number changes in `settings.ts`/`ships.ts`/outposts price formula and tell the Lead BEFORE changing any number (Andy decides).
2. **Known gaps to check:** outposts cost only a few jobs' reward (4c report); tours often too far for tanks (retest after Liner tank 100); emergency fuel in normal play (force a stuck situation through normal rules, not the debug page); rank gating usefulness.
3. **Bug hunt** in real behaviour: save/load after every action type, reload during each flight phase, `?seed=` handling, NEW GAME both options, blocked storage, switching ships during/after a trip, buying an outpost then reloading, very large and tiny windows, rapid clicking, tab hidden for a long time (clock), the `?speed=` aid.
4. **Phone checks you can run:** headless at phone sizes upright and sideways. For frame rate and real phone feel, give Andy ONE short step-by-step checklist (what to open, what to count, how to report back).
5. **Housekeeping:** commit `package-lock.json` (Andy approves the step by step instructions), remove or document leftover temporary files and stale zips list for Andy to delete by hand, make sure the README explains run/publish in plain language, and that `npm run check` is the one command that proves everything.
6. **Regression tests** for every bug found.
7. Fix only bugs inside your lane (src/save, tests, docs, glue). Bugs elsewhere go to the Lead with exact steps to reproduce; do not edit src/render, src/universe or src/game rules without the Lead's OK.

## Andy checks
Green Actions run, the phone checklist from step 4, and a decision on each balance proposal (accept / change).
