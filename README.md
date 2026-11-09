# Lazy Freight (working title)

A relaxing, funny, pixelated space game that runs in your web browser. You fly a small ship through an endless generated galaxy and take delivery jobs (cargo, passengers, tours). Trips keep running while the page is closed. The full plan is in `docs/design-doc.md`.

**Play it:** https://lieponis.github.io/Lazy-flight/

Words you will see: **GitHub** stores the project files online. **GitHub Desktop** is the program on your computer that sends your changes to GitHub ("commit" = save a change, "push" = send it). **GitHub Actions** builds and tests the game and publishes it on **GitHub Pages** (the free website). **Node.js** runs the build tools on your computer. **Terminal** is a text window where you type commands.

---

## 1. Publish a change (no terminal needed)

The site updates by itself every time a change reaches GitHub.

1. Put the changed files into your `Lazy-flight` folder (replace the old ones).
2. Open **GitHub Desktop**. The changed files are listed on the left.
3. Type a short summary at the bottom left (for example "Agent 6b balance numbers") and click **Commit to main**.
4. Click **Push origin** at the top.
5. On https://github.com/Lieponis/Lazy-flight click the **Actions** tab. Wait for the newest run to show a **green tick** (about 1 minute). A **red cross** means something failed: see section 5.
6. Open the live link and refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac).

Commit one delivery at a time and wait for the green tick before the next one.

## 2. Run it on your own computer (optional)

You do not need this to publish. It is useful for trying changes first.

1. Install **Node.js** (the "LTS" button) from https://nodejs.org. Restart your computer if asked.
2. Open **VS Code**, click **File > Open Folder** and choose the `Lazy-flight` folder.
3. Click **Terminal > New Terminal**.
4. Type `npm install` and press Enter (first time only, a minute or two).
5. Type `npm run dev` and press Enter. Hold Ctrl (Cmd on Mac) and click the link it prints. To stop: click the terminal and press Ctrl+C.

## 3. The one command that proves everything

Type `npm run check` and press Enter. It builds the game and runs every automatic test. You want to see **passed** and no red text. GitHub Actions runs the same steps on every push.

## 4. Testing aids (add to the end of the web address)

- `?speed=600` makes game time run 600 times faster, so a trip takes seconds. Leave it out for normal play.
- `?seed=777` starts a NEW game in universe 777 (it replaces your save). The game removes it from the address afterwards, so a reload continues that game.
- `game-debug.html` is the rules test page (add credits, teleport, ranks, outposts). It uses its own save.
- `debug.html` shows the universe as tables. `models.html` is the 3D model viewer.
- **MENU** (top right while docked) shows the universe seed and has **NEW GAME**.
- Your progress saves by itself in this browser. A private window plays without saving.

## 5. If something breaks

- **Red cross in the Actions tab:** click the failed run, click the red step, copy the red error text and send it to the Project Lead.
- **Blank page on the live link:** wait 2 minutes, then refresh with Ctrl+Shift+R. Check that **Settings > Pages** shows Source = **GitHub Actions**.
- **Page says 3D is not supported:** try another browser and make sure hardware acceleration is on.
- **`npm` is not recognised:** Node.js is not installed yet, or close and reopen VS Code.
- **Anything else:** copy the exact text you see and send it to the Project Lead.

## 6. For agents

- Folders: `src/universe` (the generated galaxy), `src/game` (rules and numbers: `settings.ts`, `ships.ts`), `src/render` (3D), `src/ui` (menus), `src/save` (saving). Rules: `docs/CONVENTIONS.md`.
- `npm run balance` prints the balance report (a simulator that plays many automatic games with the real rules; `tests/sim/`). Optional: `npm run balance -- 40 0.5` = 40 hours per game, trips half as long (a what-if).
- `package-lock.json` pins the exact tool versions, so every computer and GitHub Actions build the same thing.
