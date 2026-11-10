# Agent 6 brief, part 6c: balance with upgrades, then final QA (start after 5d is verified by Andy)

You are Agent 6 (Save / QA / Balance). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-6b.md, docs/report-agent-4d.md, docs/proposal-ship-upgrades.md, docs/report-agent-5d.md, docs/report-agent-7a.md. One step at a time with Andy. The only report is docs/report-agent-6c.md. Tell the Lead BEFORE changing any game number; Andy decides.

## Part A: balance
1. Teach the simulator (`tests/sim`) to buy upgrades (sensible, spender, casual, lazy players). Report: when the first level of each track arrives, how many hours to a full track and to all four on one ship, how much upgrades change credits per hour and the share of tours that are "too far", and whether credits still pile up unused at 30 hours. Targets: first level of some track soon after the first ship (a session or two), the last levels a long-term goal (many hours), nothing makes jobs trivial or locks ships out. Propose price/percent changes if needed.
2. Check the stacking rule (rank + outpost + comfort added on the plain reward, top +50%) and that rank gating still means something.

## Part B: final QA (before v1.0)
1. Save/load and reload in every state with upgrades, sound settings (7a) and liveries/planet looks if present; old saves load.
2. Phone checks: Andy has an iPhone Air; Android is untested, ask Andy whether he can borrow one. Give ONE short phone checklist (frame rate in docked view with a station, cockpit view, system view; sound start on first tap; Safari private tab).
3. Look for regressions across all screens with the headless browser at phone and desktop sizes; add regression tests for every bug.
3b. Sound (Agent 7a): on Android and desktop browsers check first tap starts sound, mute and sliders are remembered, no sound in a hidden tab, sound returns after an app switch. Add a regression test that fails if the flight phase timing used by src/ui/sound.ts drifts from the flight screen's (`planFlight`, `phaseDurations`) and one for the CSS class names the bonk detection relies on.
4. `npm audit` flagged 6 weaknesses in old BUILD/TEST tools (Vite/Vitest, not shipped). Try the upgrade of those tools ONLY if `npm run check` and a real build stay green and it takes no code changes beyond config; otherwise leave it and say why.
5. Cosmetic cleanup the Lead approves: rename the `tunnel` field in `flight.ts` (it holds the warp), remove dead code/unused settings you can prove unused (tests green), refresh the README and docs/WHERE-TO-LOOK.md if the map changed.

## Allowed / not allowed
Allowed: tests, tests/sim, docs, README, package files for the tool upgrade, tiny cosmetic renames in src/render/flight.ts. Bugs elsewhere: report with exact steps to the Lead; do not edit game rules/render/universe without the Lead's OK.

## Andy checks
Green Actions run, the phone checklist, and his decision on each balance proposal.
