# Lazy Flight

**Version 1.0.0** · *Space hauling at the speed of nap.*

A relaxing, funny, pixelated space game that runs in your web browser. Fly a small ship through an endless generated galaxy, take delivery jobs (cargo, passengers, tours), explore planets nobody has visited, buy ships, paint jobs, outposts and upgrades. No fighting, no stress. Trips keep running while the page is closed. It installs like an app and works offline. Sound and music are made by code (no sound files). The full plan is in `docs/design-doc.md`.

**Play it:** https://lieponis.github.io/Lazy-flight/
**About, screenshots, how to install:** https://lieponis.github.io/Lazy-flight/about.html

The version number lives in ONE place: `"version"` in `package.json`. Change it for every release (for example 1.0.1 for a small fix, 1.1.0 for new content); the title screen, the release page and save files pick it up when the site is built. The app icon is drawn by `node scripts/pwa/make-icons.mjs` (pictures in `scripts/pwa/icon-art.mjs`).

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

- `?speed=60` makes game time run 60 times faster: a 20-minute trip takes 20 seconds. Leave it out for normal play. (Trips are 1 minute per light year.)
- Everybody plays in ONE shared universe (seed 12345); a normal player cannot change it. `?seed=777` alone does nothing. **Developers:** `?dev=1&seed=777` starts a NEW game in universe 777 (it replaces your save; the game removes `seed` from the address afterwards, so a reload continues that game). `?dev=1` alone continues a save on another seed as it is. Without `?dev=1`, a save made on another seed is carried over to the shared universe (credits, ranks, ships and paint jobs kept; outposts paid back; explored places forgotten) the next time the page opens. The pages `debug.html`, `planets.html`, `game-debug.html` and `models.html` are developer pages and keep using `?seed=777` without the flag.
- `game-debug.html` is the rules test page (add credits, teleport, ranks, outposts). It uses its own save.
- `debug.html` shows the universe as tables. `models.html` is the 3D model viewer.
- The game opens on the title screen: **PLAY** continues your save (or starts a new game). That tap also switches the sound on.
- **MENU** (top right while docked) shows **RANKS**, **SETTINGS** (sound on/off, music and effects volume) and **NEW GAME**. The **speaker button** next to it mutes the sound (also during a flight).
- `?ship=scout` starts in the Scout (for testing the look); `?look=`, `?warp=` switch test looks (see `docs/status.md`).
- Your progress saves by itself in this browser (sound settings separately). A private window plays without saving.

## 4b. Install it as an offline app (phone and computer)

The game can be installed from the browser onto your phone's home screen, like an app (no app store, no fee). After one visit with internet, it also plays with no internet at all. Words: a **PWA** ("progressive web app") is a website the phone can install. A **service worker** is a small helper script that keeps a copy of the game's files on the phone and hands them out when there is no network.

**Install on iPhone (use Safari, not Chrome)**
1. Open https://lieponis.github.io/Lazy-flight/ in Safari. Wait until the title screen shows. (This first visit needs internet.)
2. Tap the **Share** button (a square with an arrow, at the bottom). Scroll down, tap **Add to Home Screen**, then **Add**. The name should say **Lazy Flight**.
3. Open the game from the new icon on your home screen. It opens full screen, without Safari's bars.
4. Important: the home-screen app has its OWN storage. It starts as a NEW game; your Safari save is not copied into it (moving saves comes in a later stage).

**Install on Android (Chrome):** open the link, tap the three dots menu, tap **Install app** (or **Add to Home screen**), then **Install**.
**Install on a computer (Chrome or Edge):** open the link and click the small install icon at the right end of the address bar.

**How offline works:** after the first visit the game's files are kept on your device. From then on the game starts and plays without internet (trips, jobs, free travel, saving). The first visit must be online. The developer pages (`debug.html`, `models.html`, `planets.html`, `game-debug.html`) are online only and show a friendly "No signal" page when offline. If a phone cleans out the stored files (it can do this when an app has not been opened for weeks), the next online visit fills them again; your saved game is separate and is not removed by this.

**How updating works:** when a new version is published, the next time you open the game with internet it downloads quietly in the background. You keep playing the old version. When you are not on a trip, a small note "NEW VERSION READY" appears at the bottom: tap **REFRESH** to switch now, or **LATER**. If you ignore it, the new version starts the next time you close the app completely and open it again. An update never changes your saved game, and the new version is switched on only when it has downloaded completely (never half old, half new).

**How to remove it:** on iPhone, press and hold the icon, tap **Remove App**, then **Delete App**. Careful: this also deletes that app's saved game.

**The kill switch (only if a bad version ever gets stuck on phones)**
If a broken version were stuck on phones, you can switch the offline app off for everyone:
1. On https://github.com/Lieponis/Lazy-flight click the file `pwa-mode.txt`, then the pencil icon (Edit).
2. Change the last line from `on` to `retire`.
3. Click **Commit changes**, then **Commit changes** again.
4. Click the **Actions** tab and wait for the green tick (about 1 minute).
5. Phones fix themselves the next time they open the game with internet: they delete the stored copy and load the game from the web again. The screen may reload once by itself.
To switch the offline app on again, change `retire` back to `on` and repeat steps 3 and 4.

## 5. If something breaks

- **Red cross in the Actions tab:** click the failed run, click the red step, copy the red error text and send it to the Project Lead.
- **Blank page on the live link:** wait 2 minutes, then refresh with Ctrl+Shift+R. Check that **Settings > Pages** shows Source = **GitHub Actions**.
- **Page says 3D is not supported:** try another browser and make sure hardware acceleration is on.
- **`npm` is not recognised:** Node.js is not installed yet, or close and reopen VS Code.
- **Anything else:** copy the exact text you see and send it to the Project Lead.

## 6. For agents

- Folders: `src/universe` (the generated galaxy), `src/game` (rules and numbers: `settings.ts`, `ships.ts`, `upgrades.ts`), `src/render` (3D), `src/ui` (menus, title screen), `src/audio` (sound and music), `src/save` (saving). Map of everything: `docs/WHERE-TO-LOOK.md`. Rules: `docs/CONVENTIONS.md`.
- `npm run balance` prints the balance report (a simulator that plays many automatic games with the real rules; `tests/sim/`). Optional: `npm run balance -- 40 0.5 100` = 40 hours per game, trips half as long (a what-if), and 100 hours for the upgrade tables.
- Offline app (stage P1): `public/` holds the manifest, the offline page and the icons (`public/icons/`; to use real art, replace those four PNG files with the same names and sizes; `node scripts/pwa/make-icons.mjs` redraws the placeholders). `npm run build` ends with `scripts/pwa/postbuild.mjs`, which writes `dist/sw.js` from `scripts/pwa/sw.template.js`, lists every file the game needs (and STOPS the build if a file is missing or unknown), and prints the list in the build log. `pwa-mode.txt` is the kill switch. Only `src/ui/updatenote.ts` (and 3 lines in `src/main.ts`) touches the service worker. Tests: `tests/pwa.test.ts`.
- `package-lock.json` pins the exact tool versions, so every computer and GitHub Actions build the same thing.
