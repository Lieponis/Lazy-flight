# Agent 6 brief, stage G6 (LEAN): is universe v3 safe to merge into main?

You are Agent 6 (Save / QA / Balance). Branch `universe-v3` holds the new galaxy (universe, game, save, map, screens, bulge). Andy checked the pieces on his iPhone. **Andy's usage limit is tight: do ONLY the checks below, nothing else.** Work on branch `universe-v3`, current head. Nothing merges in this stage; the Lead merges after your verdict. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), at most 6 steps. Explain technical words in one sentence. Combat never. Report: docs/report-agent-6h.md, SHORT (one screen of plain summary first, then tables).

## Saving usage (rules for you)
- Read only the files named here. Do not read old briefs or old reports unless a check needs one fact from it (search for that fact, do not open whole files).
- Do not rerun things that are already green on Actions. Use the CI logs.
- No 30-seed balance run, no full page-by-page regression, no performance study (Andy's iPhone already measured the map at 60 fps; Agent 3 and 4 have numbers). Not asked = not done. Anything else you notice: one line under "Noticed, not checked".
- One message to Andy per step, with the exact thing to tap.

## Read first (only these)
docs/status.md (last 80 lines), docs/universe-v3-game-api.md, report-agent-4i.md section 6 (migration), report-agent-5i.md section 2 (texts), docs/briefs/agent-6f-brief.md (only the offline check part).

## The only checks (in this order)
1. **CI is green.** On branch `universe-v3`: "Check a branch", "Check the game layer" and the preview build are green (Agent 2 is fixing two slow bulge tests; if still red, say which and stop here until fixed). Give the run links.
2. **Old saves through the real load path (the biggest risk).** Take the old-save fixtures from main's code (`tests/fixtures/old-saves/`, v1 and v2 with a job in flight, free trip, outposts, many explored) PLUS one save Andy exports from the LIVE game today (SAVE FILE menu; tell him exactly how and where to send it). Prove each loads on the new build: credits, ships, upgrades, paint jobs, ranks kept; ship at the start dock; job/trip cancelled; outposts refunded; "universe rebuilt" note once; second load quiet; imported file the same. Run through the real page code path (Vitest through `planStart` and the import path is fine). One line per save in a table.
3. **Update path of the offline app (second biggest risk).** Build main and the branch, run `npm run offline-check` (brief 6f) on both; check the new build's service worker version differs, the old cache box is replaced safely, the update note appears only at a safe moment, the save survives. List exactly what only a real phone can prove and give Andy **ONE short phone checklist** (5 taps at most) for right after the merge: open the installed old game, update, see credits and ships, airplane mode, relaunch.
4. **Far-dock text fix (small, allowed in `src/game`):** the message says "The next dock is 94.7 ly away" even when the same system has another dock at 0 ly. Fix the wording rule (talk about the nearest dock in ANOTHER system, or say the system's own docks have no jobs), add one test, tell the Lead exactly what you touched.
5. **Balance sanity, small:** only the world seed, only three player types (sensible, lazy, spender), 30 game hours each, using the existing simulation: income per hour at the start region, that a player can move outward by hopping (dock spacing 3 to 21 ly at the start), and the share of start-region boards with 0, 1, 2+ doable jobs (Agent 4: 93% have 1+, 74% have 2+). Report only problems and options for Andy. **Do not change any balance number without Andy.**
6. **Two spot checks from Agent 2 (report-agent-2f section 9):** `getSystem` works for a number above 46.6 billion (a bulge system) with planets, docks and a job board; and a disc system and a bulge system very close to each other do not break planets or docks.

## Report: verdict line first
`MERGE READY` / `MERGE READY AFTER THESE FIXES: (list)` / `NOT READY: (why)`. Then: the table of checks (pass / fail / not verifiable and why), the old-save table, the update-path findings and the phone checklist, balance problems with options (if any), what you touched, "Noticed, not checked" (one line each), suggestions labelled "suggestion".

## Allowed / not allowed
Allowed: tests, fixtures, scripts, package.json scripts, check workflows (say exactly what; never change "Build and publish" or "Refresh the preview"), docs, small fixes in `src/save`, and the one text fix in step 4. Not allowed: other layers' code, new features, balance numbers, merging into main.
