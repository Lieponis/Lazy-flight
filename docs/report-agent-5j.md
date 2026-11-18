# Agent 5 report, 5j: seats line and map legend

On main, commit 2b6b523, live. Andy chose **B** for both texts and checked both on his phone: "Ok".

## What was built
1. **The seats line on the job board.**
   - Exact text: `Passengers are waving at you, but your ship has no seats. A cabin ship from the SHIPYARD can carry them.`
   - It appears when at least one board job has the game's `no-cabin` block. The count comes from `noCabinCount`, in `src/ui/logic.ts`.
   - It is added to the existing message box. When nothing else needs saying, the box shows it alone under the title `PASSENGERS WAITING`.
   - `boardMessage(summary, place, noCabinJobs)` now returns a `seats` field ("" when unused).
2. **The galaxy map legend.**
   - Exact text: `Diamonds: stars you can reach. Little dots: too far for now.`
   - It is shown only on the galaxy map (`starmap`) with no menu open. It is defined in the new `src/ui/maplegend.ts`.
   - It sits just above the map's `.hud-label` and follows that label's size, so it never covers the hint or the tapped star's name.

## Files
- `src/ui/logic.ts`, `src/ui/jobsmenu.ts`, `src/ui/maplegend.ts` (new), `src/ui/index.ts` (2 glue lines), `src/ui/theme.css`.
- `tests/ui.test.ts`: new tests for both texts. The G5b rim test now checks only the jobs that are too far, because a job inside the same system can be blocked by `no-cabin` instead.

## Test status
- `npm run check` green.
- The "Build and publish" run for 2b6b523 failed on `tests/starfield.test.ts`, which is not UI. The next push (G8 3m) fixed it, and that run is green and live.

## Known issues
None.
