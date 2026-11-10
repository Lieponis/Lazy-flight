# Where to look (for every agent, now and later)

The one source of truth is the `main` branch of the GitHub repository `Lieponis/Lazy-flight`. Do NOT work from an old zip: zips go stale and have caused lost changes. If you cannot read the repository, tell Andy; the Lead will help.

## Read these first, in this order
1. `docs/status.md` : what is done, what is running now, decisions, known issues. Newest facts are at the top and at the bottom.
2. `docs/briefs/` : YOUR brief (the file named in your pointer prompt). It is your job description for this stage.
3. `docs/design-doc.md` : the game design (vision, loop, screens). `docs/OUT-OF-SCOPE.md` : what we never build (free flight and combat are permanently out).
4. `docs/CONVENTIONS.md` : rules for code and layers.
5. The reports of the agents before you: `docs/report-agent-*.md` (what they built, how to use it, known issues).

## Map of the repository
| Where | What |
|---|---|
| `docs/` | all documents: status, briefs, reports, design, guides |
| `docs/briefs/agent-*-brief.md` | one brief per agent stage |
| `docs/report-agent-*.md` | one report per finished stage |
| `docs/ASSET-CATALOG.md`, `STYLE-GUIDE.md`, `ASSET-PIPELINE.md` | ships, outposts, stations, cockpit: designs, rules, stages (Agent 8) |
| `docs/cockpit-design-brief.md`, `ROADMAP-cockpit.md`, `INTEGRATION-cockpit.md` | cockpit: approved design, stages, technical notes |
| `docs/GUIDE-visual-direction.md` | how Andy shows what he wants (reference sheet, options A/B/C) |
| `src/universe/` | the generated universe (pure logic, no graphics) |
| `src/game/` | rules: jobs, money, fuel, ships, ranks, outposts, clock |
| `src/save/` | saving and loading (browser storage) |
| `src/render/` | all 3D: docked view, system view, flight, starmap, cockpit use |
| `src/render/assets/` | Agent 8's models (ships, outposts, stations, cockpit base, lens) and the model checker |
| `src/ui/` | menus, status strip, shipyard, ranks, messages, fonts |
| `src/main.ts` | starts everything |
| `tests/` | all automatic tests (`npm run check` runs them) |
| `index.html`, `models.html`, `debug.html`, `game-debug.html` | the game, the model viewer, the universe debug page, the game-rules debug page |

## Layer rules (a test enforces them)
`src/universe` imports nothing from render, ui, game or save. `src/render` never imports `src/game` or `src/ui`. Glue between layers lives in `src/ui/index.ts` and `src/main.ts`. Stay in the files your brief allows.

## How to prove your work
`npm run check` (types, build and all tests). Then a green run on the GitHub Actions tab, then Andy's click-test. Live game: https://lieponis.github.io/Lazy-flight/ (testing aids: `?speed=600`, `?seed=NUMBER`, `?ship=scout`). Model viewer: `/models.html`. If you cannot run something, say so honestly in your report.

## How to hand in
- Push to `main` if you have GitHub access (small, clear commits, only the files your brief allows). Otherwise give Andy one zip with ONLY the changed files.
- Your one report goes to `docs/report-agent-XX.md`: what was built, how to check it, live link, known issues and what is NOT verified, notes for the next agents, suggestions (labelled "suggestion").
- Add a short line to `docs/status.md` only if your brief says so; otherwise the Lead does it.

## Working with Andy
Andy has no programming experience. Plain language, one step per message: Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH. Options A/B/C before building anything visual. Never change something Andy already decided.

## Where files will be in the future
New briefs: `docs/briefs/`. New reports: `docs/report-agent-*.md`. New code: inside the folder of its layer above. New documents: `docs/`. This file is updated by the Lead when the map changes.
