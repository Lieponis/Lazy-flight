# Lazy Freight (working title)

A relaxing, funny, pixelated space game that runs in your web browser. You fly a small ship through an endless generated galaxy and take delivery jobs. The full plan is in `docs/design-doc.md`.

**Right now this project is only the foundation:** a spinning pixelated cube that proves the build and publishing pipeline works. There is no game yet.

Words you will see: **GitHub** is a free website that stores project files. **GitHub Pages** is its free service that turns those files into a public website. **Node.js** is free software that runs the build tools on your computer. **Terminal** is a text window where you type commands.

---

## 1. Publish it online (no terminal needed)

You only do this once. After that, every time files change on GitHub, the site updates by itself.

**A. Make the repository** (a repository is just a project folder on GitHub)
1. Go to https://github.com and sign in.
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `lazy-freight`.
4. Choose **Public** (free GitHub Pages needs this).
5. Do NOT tick "Add a README". Click **Create repository**.

**B. Upload the files**
1. Unzip `lazy-freight.zip` on your computer.
2. On the new empty repository page, click the link **uploading an existing file**.
3. Open the unzipped folder, select everything INSIDE it (not the folder itself), and drag it all into the browser window. Wait until all files finish uploading.
4. Scroll down and click **Commit changes**.

**C. Turn on GitHub Pages**
1. Click **Settings** (top row of the repository page).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

**D. Check the publishing recipe was uploaded**
1. Click the **Actions** tab (top row).
2. If you see a run named **Build and publish**, skip to E.
3. If Actions is empty, the hidden `.github` folder did not upload (common on Mac). Fix it:
   1. Go to the **Code** tab, click **Add file**, then **Create new file**.
   2. In the name box type exactly: `.github/workflows/deploy.yml` (typing each `/` makes a folder).
   3. Open `docs/deploy.yml.txt` from the unzipped folder, copy everything, and paste it into the big text box.
   4. Click **Commit changes**, then **Commit changes** again.

**E. Find your live link**
1. Click the **Actions** tab. Click the newest run. Wait for green ticks (about 1 to 2 minutes).
2. If the run is red, see "If something breaks" below.
3. Your link is `https://YOUR-GITHUB-NAME.github.io/lazy-freight/`. It is also shown in **Settings > Pages**.
4. Open it. You should see a chunky, pixelated cube spinning on a dark background.

If the first run failed because Pages was not on yet: do step C, then in **Actions** click the failed run and click **Re-run all jobs**.

---

## 2. Run it on your own computer (optional)

You do not need this to publish. It is useful when you want to try changes before uploading.

1. Install **Node.js** (the "LTS" button) from https://nodejs.org and accept the defaults. Restart your computer if asked.
2. Open **VS Code** (a free program for viewing and editing project files). Click **File > Open Folder** and choose the unzipped `lazy-freight` folder.
3. Click **Terminal > New Terminal**. A text panel opens at the bottom. It is already in the right folder.
4. Type `npm install` and press Enter. Wait until it finishes (a minute or two). This downloads the tools.
5. Type `npm run dev` and press Enter. It prints a link like `http://localhost:5173/`. Hold Ctrl (or Cmd on Mac) and click it. The cube appears.
6. To stop it, click in the terminal and press Ctrl+C.

## 3. Run the tests

In the VS Code terminal type `npm test` and press Enter. You want to see **passed** and no red text.

To run the build AND the tests together, type `npm run check`.

## 4. Change how chunky the pixels are

Open `src/settings.ts`. Change `RENDER_WIDTH` and `RENDER_HEIGHT` (keep them 16:9, for example 320x180 or 480x270). Smaller is chunkier and faster on phones.

## 5. If something breaks

- **Red cross in the Actions tab:** click the failed run, click the red step, and copy the red error text. Send it to the Project Lead.
- **Blank page on the live link:** wait 2 minutes and refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac). Check that Settings > Pages shows Source = GitHub Actions.
- **Page says 3D is not supported:** try another browser (Chrome, Edge, Firefox, Safari) and make sure hardware acceleration is on.
- **`npm` is not recognised:** Node.js is not installed yet, or you need to close and reopen VS Code after installing it.
- **Anything else:** copy the exact text you see and send it to the Project Lead. Do not worry about reading it.

## Project folders

| Folder | What it is for |
| --- | --- |
| `src/universe` | Pure logic that builds the galaxy from a seed. Never touches graphics. |
| `src/render` | Everything you see (Three.js). |
| `src/game` | Missions, credits, fuel, travel. |
| `src/ui` | Menus and HUD. |
| `src/save` | Saving and loading progress. |
| `tests` | Automatic checks. |
| `docs` | Design doc, rules and agent reports. |

Rules for the layers are in `docs/CONVENTIONS.md`. What we are NOT building is in `docs/OUT-OF-SCOPE.md`.
