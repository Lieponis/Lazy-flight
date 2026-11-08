# Agent 1 report: Setup / Infrastructure

**Status: files written, NOT yet verified end to end.** Network access for installs was off in my workspace, so I could not run the build, the tests, or open the site in a browser. Details below.

## 1. What was built

- Vite + TypeScript + Three.js project (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`).
- A spinning low-poly cube (`src/main.ts`) rendered at 320x180 and stretched to the window with no smoothing, kept 16:9 with black bars. Dark space background.
- The render size is one setting: `src/settings.ts` (`RENDER_WIDTH`, `RENDER_HEIGHT`).
- Phone handling: no page scrolling, no pinch zoom, resizes with the window (`src/style.css`, viewport tag in `index.html`).
- Folders with one-line READMEs: `src/universe`, `src/render`, `src/game`, `src/ui`, `src/save`, `tests`, `docs`.
- Vitest with 4 real tests (`tests/settings.test.ts`, `tests/layer-rule.test.ts`). The layer-rule test fails if anything in `src/universe` imports Three.js, render, ui, game or save.
- One command for build + tests: `npm run check`.
- Auto-publish: `.github/workflows/deploy.yml` runs tests, builds, and publishes to GitHub Pages on every push to `main`. A copy is in `docs/deploy.yml.txt` in case the hidden `.github` folder does not upload.
- Root `README.md` (plain language, click-by-click), `.gitignore`, `docs/CONVENTIONS.md`, `docs/OUT-OF-SCOPE.md`, `docs/design-doc.md`.

## 2. How to run it on Andy's computer

See the root `README.md`, section 2. Short version: install Node.js, open the folder in VS Code, Terminal > New Terminal, `npm install`, `npm run dev`, open the link it prints.

## 3. Live link

Not available yet. It will be `https://<github-name>.github.io/lazy-freight/` once Andy follows README section 1 and the first Actions run is green.

## 4. Known issues / what is NOT verified

Done checklist, honestly:

- [ ] Production build with no errors: **not run** (could not install packages here). GitHub Actions will run it on the first push.
- [ ] Tests pass: **not run** for the same reason.
- [ ] Live link opened in a real browser: **not done** (no link yet).
- [ ] Checked at a phone-sized window: **not done**.
- [ ] README steps tested as written: **not done**.

What I did verify: `src/settings.ts` type-checks and gives a 16:9 ratio (1.7778); `package.json` and `tsconfig.json` are valid JSON.

Specific risks to watch on the first run:
- I picked library versions from memory without installing them (three 0.170.0, vite 6, vitest 2, TypeScript 5.6). They should exist and work together, but a version or type error is possible. If the first Actions run is red, send the error text to the Project Lead and it will be a quick fix.
- No `package-lock.json` yet, so the workflow uses `npm install`. Suggestion: add the lock file after the first local `npm install`.
- If Pages is not switched on before the first push, the first deploy fails; re-run it after switching it on (README step C).
- Dotfolder `.github` may not upload via drag-and-drop on Mac; README step D covers this.
- The cube uses plain lighting only. Dithering, palette limits and vertex wobble from the art direction are not included, by design (those are Agent 3's job).

## 5. What Agent 2 (Universe Generator) needs to know

- Put code in `src/universe/`, tests in `tests/` named `something.test.ts`.
- `src/universe` must never import Three.js or render/ui/game/save. `tests/layer-rule.test.ts` enforces it.
- Layer order: galaxy > system > planet > dock > jobs (see `docs/CONVENTIONS.md`).
- Run tests: `npm test`. Run build + tests: `npm run check`.
- Do not start until the live link works and Actions is green.

## 6. Suggestions (labeled, not built)

- Suggestion: add `package-lock.json` after the first local install, so builds are identical every time.
- Suggestion: add a VS Code recommended-extensions file to make editing friendlier for Andy.
