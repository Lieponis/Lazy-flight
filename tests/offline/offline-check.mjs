// npm run offline-check (stage P4, Agent 6): proves with a real (headless) browser that the BUILT game works offline.
// Builds nothing itself unless asked: `npm run offline-check` builds first (see package.json), then runs this.
//
// What it does (the roadmap's tests 1-9, docs/ROADMAP-offline-app.md "Test workflow", plus the kill switch):
//  1 first online visit stores ONE complete box of files          2 offline reload: no errors, nothing asked from the server
//  3 scripted offline loop: job, paint job, free trip, reload = same 4 every screen offline at phone (both ways) and desktop
//  5 update A -> B: note only at a safe moment, REFRESH switches, never mixed, old box gone, save kept
//  6 old saves (universe v1, before F1, before paint jobs, another seed) load offline through the real page start
//  7 stored copy wiped + offline: the friendly in-game page, never the browser error (also for developer pages)
//  8 save file export / import / undo / garbage offline       9 this runner: plain summary, exit code 1 on any failure
//  K kill switch (pwa-mode retire, in a temporary copy): the helper clears its boxes and unregisters
//
// Usage: node tests/offline/offline-check.mjs [--dist dist] [--only 1,2,3] [--keep]  (--keep leaves the temp folders)

import { chromium } from "playwright";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";
import * as d from "./driver.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const distDir = resolve(root, argValue("--dist") ?? "dist");
const only = argValue("--only")?.split(",").map((s) => s.trim().toUpperCase());
const keep = args.includes("--keep");

const SPEED = "?speed=600"; // game time 600x: a trip takes seconds (the testing aid; the normal player never sees it)
const PHONE_UP = { width: 390, height: 844 };
const PHONE_SIDE = { width: 844, height: 390 };
const DESKTOP = { width: 1280, height: 800 };

// ------------------------------------------------------------ results
const results = [];
function record(id, name, ok, details = []) {
  results.push({ id, name, ok, details });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`\n[${mark}] ${id}. ${name}`);
  for (const line of details) console.log(`        ${line}`);
}
async function check(id, name, fn) {
  if (only && !only.includes(String(id))) return;
  const notes = [];
  try {
    const problems = (await fn(notes)) ?? [];
    record(id, name, problems.length === 0, [...notes, ...problems.map((p) => `PROBLEM: ${p}`)]);
  } catch (error) {
    record(id, name, false, [...notes, `PROBLEM: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`]);
  }
}

// ------------------------------------------------------------ the builds under test
if (!existsSync(join(distDir, "sw.js"))) {
  console.error(`No built game in ${distDir}. Run "npm run build" first (npm run offline-check does that).`);
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), "lf-offline-"));
const buildA = join(work, "A");
const buildB = join(work, "B");
const buildR = join(work, "retire");
cpSync(distDir, buildA, { recursive: true });
// Build B = the same game with one changed file, re-sealed by the real postbuild script (new file list + new version).
cpSync(distDir, buildB, { recursive: true });
// Marks: a <meta> in the page and a line in the main script, so the check can see that ALL of the page is version B.
writeFileSync(join(buildB, "index.html"), readFileSync(join(buildB, "index.html"), "utf8").replace("</head>", '<meta name="lf-build" content="B"></head>'));
for (const f of readdirSync(join(buildB, "assets"))) {
  if (/^main-.*\.js$/.test(f)) writeFileSync(join(buildB, "assets", f), readFileSync(join(buildB, "assets", f), "utf8") + "\n;globalThis.__lfBuild = \"B\";\n");
}
execFileSync(process.execPath, [join(root, "scripts", "pwa", "postbuild.mjs"), buildB], { stdio: "pipe" });
// Kill-switch build: a REAL build with pwa-mode.txt = "retire", made in a temporary copy of the project (the real
// pwa-mode.txt is never touched). Its pages do not register the helper, and its sw.js is the kill switch.
function retireBuild() {
  const copy = join(work, "project-retire");
  for (const item of ["index.html", "debug.html", "models.html", "game-debug.html", "planets.html", "about.html", "src", "public", "scripts", "package.json", "tsconfig.json", "vite.config.ts"]) {
    if (existsSync(join(root, item))) cpSync(join(root, item), join(copy, item), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(copy, "node_modules"), "dir");
  writeFileSync(join(copy, "pwa-mode.txt"), "retire\n");
  execFileSync(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", buildR, "--emptyOutDir"], { cwd: copy, stdio: "pipe" });
  execFileSync(process.execPath, [join(copy, "scripts", "pwa", "postbuild.mjs"), buildR], { cwd: copy, stdio: "pipe" });
  if (!readFileSync(join(buildR, "sw.js"), "utf8").includes("kill switch")) throw new Error("the retire build did not write the kill switch");
}
if (!only || only.includes("K")) retireBuild();

const swVersion = (dir) => /const VERSION = "([^"]+)"/.exec(readFileSync(join(dir, "sw.js"), "utf8"))?.[1] ?? null;
const filesOf = (dir) => {
  const m = /const FILES = (\[.*?\]);/.exec(readFileSync(join(dir, "sw.js"), "utf8"));
  return m ? JSON.parse(m[1]).map((f) => f.path) : [];
};
const versionA = swVersion(buildA);
const versionB = swVersion(buildB);

const server = await startServer(buildA);
const browser = await chromium.launch({ args: d.LAUNCH_ARGS });
console.log(`Offline checks on the built game (version ${versionA}; update test to ${versionB}). Server: ${server.url}`);

/** A fresh browser profile with the game installed (first online visit done, helper in control). */
async function freshInstalled(viewport = DESKTOP, query = SPEED) {
  server.setRoot(buildA);
  const context = await browser.newContext({ viewport, serviceWorkers: "allow" });
  const page = await context.newPage();
  const w = d.watch(page);
  await page.goto(server.url + query);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  return { context, page, w };
}

async function cacheInfo(page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const n of names) out[n] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname);
    return out;
  });
}

/**
 * Changes the game's storage safely: first leave the game (go to the small offline.html page, served by the helper
 * also offline), so the game's own "save when the page is hidden" cannot write its old state back over the change.
 */
async function editStorage(page, fn, arg) {
  await page.goto(server.url + "offline.html");
  await page.evaluate(fn, arg);
  await page.goto(server.url + SPEED);
}

const noErrors = (w, where) => [...w.errors.map((e) => `${where}: ${e}`), ...w.failed.map((f) => `${where}: request failed ${f}`)];

// ------------------------------------------------------------ 1
await check(1, "First online visit: helper ready, ONE complete box of files", async (notes) => {
  const { context, page, w } = await freshInstalled();
  const boxes = await cacheInfo(page);
  const names = Object.keys(boxes);
  const problems = [];
  if (names.length !== 1) problems.push(`expected 1 box, found ${names.length}: ${names.join(", ")}`);
  const want = filesOf(buildA).map((p) => `/Lazy-flight/${p}`);
  const have = new Set(boxes[names[0]] ?? []);
  const missing = want.filter((p) => !have.has(p) && !(p.endsWith("/index.html") && have.has(p.replace(/index\.html$/, ""))));
  if (missing.length) problems.push(`files missing from the box: ${missing.join(", ")}`);
  notes.push(`box ${names[0]} with ${have.size} files (the build lists ${want.length})`);
  problems.push(...noErrors(w, "online visit"));
  await context.close();
  return problems;
});

// ------------------------------------------------------------ 2
await check(2, "Offline reload: the game starts, no errors, nothing asked from the server", async (notes) => {
  const { context, page, w } = await freshInstalled();
  const problems = [];
  // (a) online but the files come from the box: the server sees only the helper's own update check, if anything
  server.clearLog();
  await page.reload();
  await d.waitForTitle(page);
  const asked = server.log.filter((p) => !p.endsWith("/sw.js"));
  if (asked.length) problems.push(`online reload asked the server for game files: ${asked.slice(0, 5).join(", ")}`);
  // (b) offline
  await context.setOffline(true);
  w.reset();
  server.clearLog();
  await page.reload();
  if (await d.isBrowserErrorPage(page)) problems.push("the browser error page appeared");
  await d.play(page);
  if (server.log.length) problems.push(`the server was asked ${server.log.length} times while offline`);
  problems.push(...noErrors(w, "offline reload"));
  notes.push(`online reload asked the server ${asked.length} times for game files; offline reload: ${w.network.length} requests, all answered by the helper`);
  await context.close();
  return problems;
});

// ------------------------------------------------------------ 3
let loopSave = null;
await check(3, "Offline play: job delivered, paint job bought, free trip to a scenery planet, reload = same game", async (notes) => {
  const { context, page, w } = await freshInstalled();
  await d.play(page);
  await context.setOffline(true);
  await page.reload();
  await d.play(page);
  w.reset();
  let jobs = 0;
  for (let i = 0; i < 6; i++) {
    const pay = await d.acceptAndDeliver(page);
    jobs++;
    notes.push(`job ${jobs} delivered offline, paid ${pay} CR`);
    if ((await d.readSave(page)).state.credits >= 560) break;
  }
  const paint = await d.buyPaintJob(page);
  notes.push(`paint job bought offline: ${JSON.stringify(paint)}`);
  const discoveries = (ex) => Object.values(ex ?? {}).reduce((n, bits) => n + 1 + (bits.toString(2).match(/1/g) ?? []).length, 0);
  const exploredBefore = discoveries((await d.readSave(page)).state.explored);
  const floating = await d.freeTripToScenery(page);
  const exploredAfter = discoveries(floating.state.explored);
  notes.push(`free trip offline to ${floating.state.spacePlanetId}; explored systems+planets ${exploredBefore} -> ${exploredAfter}`);
  const problems = [];
  if (exploredAfter <= exploredBefore) problems.push("the free trip did not count as explored (Explorer arrival)");
  const before = d.comparable(await d.readSave(page));
  await page.reload();
  await d.play(page);
  const after = d.comparable(await d.readSave(page));
  if (JSON.stringify(before) !== JSON.stringify(after)) problems.push("the game after the offline reload is not the same as before");
  const floatingNow = await page.locator("button:visible", { hasText: "WHAT NOW?" }).count();
  if (!floatingNow) problems.push("after the reload the game is not floating at the planet (no WHAT NOW? button)");
  problems.push(...noErrors(w, "offline play"));
  loopSave = await d.readSave(page);
  await context.close();
  return problems;
});

// ------------------------------------------------------------ 4
await check(4, "Every screen offline at phone (upright, sideways) and desktop sizes", async (notes) => {
  const problems = [];
  for (const [label, vp] of [["phone upright", PHONE_UP], ["phone sideways", PHONE_SIDE], ["desktop", DESKTOP]]) {
    const { context, page, w } = await freshInstalled(vp);
    await context.setOffline(true);
    if (loopSave) await editStorage(page, ([k, v]) => localStorage.setItem(k, v), [d.SAVE_KEY, JSON.stringify({ ...loopSave, state: { ...loopSave.state, spacePlanetId: null, credits: 50000 } })]);
    else await page.reload();
    w.reset();
    const seen = [];
    const look = async (name) => {
      if (await d.isBrowserErrorPage(page)) problems.push(`${label} ${name}: browser error page`);
      for (const o of await d.overflowReport(page)) problems.push(`${label} ${name}: ${o}`);
      seen.push(name);
    };
    await d.waitForTitle(page);
    await look("title");
    await page.click(".ui-title-play");
    await page.waitForTimeout(1200);
    await look("docked");
    await d.clickButton(page, "JOBS");
    await look("Jobs");
    await d.closeOverlays(page);
    await d.clickButton(page, "SHIPYARD");
    await look("Shipyard");
    await d.closeOverlays(page);
    for (const panel of ["RANKS & OUTPOSTS", "SETTINGS", "SAVE FILE"]) {
      await d.openMenuPanel(page, panel);
      await look(panel === "RANKS & OUTPOSTS" ? "Ranks" : panel);
      await d.closeOverlays(page);
      await d.closeOverlays(page);
    }
    await d.clickButton(page, "MAP");
    await page.waitForTimeout(1000);
    await look("system view");
    await d.clickButton(page, /^GALAXY$/);
    await page.waitForTimeout(1500);
    await look("galaxy map");
    await d.clickButton(page, /^SYSTEM$/);
    await page.waitForTimeout(800);
    // flight: a free trip to a scenery planet, looked at while flying, then floating there
    const card = await d.selectPlanetWithFly(page, /SCENERY/);
    if (!card) problems.push(`${label}: no scenery planet found to fly to`);
    else {
      await d.clickButton(page, "FLY HERE");
      await page.waitForTimeout(600);
      await look("flight");
      const end = Date.now() + 60000;
      while (Date.now() < end && (await d.readSave(page)).state.freeTrip) await page.waitForTimeout(500);
      await page.waitForTimeout(2000);
      await look("floating");
    }
    problems.push(...noErrors(w, label));
    notes.push(`${label} ${vp.width}x${vp.height}: ${seen.join(", ")}`);
    await context.close();
  }
  return problems;
});

// ------------------------------------------------------------ 5
await check(5, "Update A -> B: note only at a safe moment, REFRESH switches, never mixed, old box gone, save kept", async (notes) => {
  const problems = [];
  const { context, page, w } = await freshInstalled(DESKTOP, "?speed=60");
  await d.play(page);
  const creditsA = (await d.readSave(page)).state.credits;
  // go offline, put build B on the server, start a job (an unsafe moment), come back online
  await context.setOffline(true);
  server.setRoot(buildB);
  await d.clickButton(page, "JOBS");
  const accept = page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first();
  await accept.click();
  await page.waitForTimeout(600);
  await context.setOffline(false);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const noteDuringTrip = await page.locator(".lf-update:visible").count();
  if (noteDuringTrip) problems.push("the update note showed DURING a trip");
  notes.push(`new version downloaded in the background while flying; note during the trip: ${noteDuringTrip ? "shown (bad)" : "hidden"}`);
  const stillA = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => s.includes("/assets/")) ?? "");
  // land (60x speed), then the note must appear
  await d.waitDocked(page, 120000);
  await page.waitForTimeout(1500);
  const dismiss = page.locator("button:visible", { hasText: "DISMISS" }).first();
  if (await dismiss.count()) await dismiss.click();
  await page.waitForSelector(".lf-update:visible", { timeout: 15000 }).catch(() => problems.push("the update note did not appear when docked"));
  const creditsBefore = (await d.readSave(page)).state.credits;
  await page.locator(".lf-update button", { hasText: "REFRESH" }).click();
  await page.waitForLoadState("load");
  await d.waitForTitle(page);
  const boxes = Object.keys(await cacheInfo(page));
  if (boxes.length !== 1 || !boxes[0].endsWith(versionB)) problems.push(`boxes after the update: ${boxes.join(", ")} (want only lazy-flight-${versionB})`);
  const marks = await page.evaluate(() => ({ page: document.querySelector('meta[name="lf-build"]')?.getAttribute("content") ?? "A", script: globalThis.__lfBuild ?? "A" }));
  if (marks.page !== "B") problems.push("the page is not version B after REFRESH");
  if (marks.script !== "B") problems.push("the main script is not version B after REFRESH (versions mixed)");
  notes.push(`after REFRESH: page ${marks.page}, main script ${marks.script}`);
  await d.play(page);
  const after = await d.readSave(page);
  if (!after || after.state.credits !== creditsBefore) problems.push(`save changed by the update (${creditsBefore} -> ${after?.state.credits})`);
  notes.push(`credits ${creditsA} -> delivered -> ${creditsBefore}; after REFRESH: version B, ${boxes.join(", ")}, credits ${after?.state.credits}; old script was ${stillA.split("/").pop()}`);
  problems.push(...noErrors(w, "update"));
  await context.close();
  server.setRoot(buildA);
  return problems;
});

// ------------------------------------------------------------ 6
await check(6, "Old saves load offline through the real page start (v1, before F1, before paint jobs, another seed, before import)", async (notes) => {
  const problems = [];
  const { context, page, w } = await freshInstalled();
  await d.play(page);
  await d.acceptAndDeliver(page);
  const base = await d.readSave(page);
  const st = base.state;
  const variants = {
    "universe v1 (old dock id, outposts, no universeVersion)": (() => {
      const { universeVersion: _u, ...v1 } = base;
      void _u;
      return { ...v1, state: { ...st, currentDockId: "1:1:1:0/6", ownedOutposts: ["1:2:1:0/3"], outpostCount: 1, outpostPrices: {} } };
    })(),
    "before F1 (no spacePlanetId, freeTrip, explored)": (() => {
      const s = { ...st };
      delete s.spacePlanetId;
      delete s.freeTrip;
      delete s.explored;
      return { ...base, state: s };
    })(),
    "before paint jobs (no shipLiveries)": (() => {
      const s = { ...st };
      delete s.shipLiveries;
      return { ...base, state: s };
    })(),
    "another seed (777)": { ...base, seed: 777, state: { ...st, currentDockId: "5:5:5:0/1" } },
    "before import (plain save, no undo slot)": base,
    "very old (most newer fields missing)": (() => {
      const s = { ...st };
      for (const k of ["spacePlanetId", "freeTrip", "explored", "shipLiveries", "shipUpgrades", "deliveredJobIds", "ownedShips", "outpostPrices", "completedJobs"]) delete s[k];
      const { universeVersion: _u, ...v } = base;
      void _u;
      return { ...v, state: s };
    })(),
  };
  await context.setOffline(true);
  for (const [name, save] of Object.entries(variants)) {
    w.reset();
    await editStorage(page, ([k, v]) => {
      for (const key of Object.keys(localStorage)) if (key.startsWith("lazy-freight.save")) localStorage.removeItem(key);
      localStorage.setItem(k, v);
    }, [d.SAVE_KEY, JSON.stringify(save)]);
    if (await d.isBrowserErrorPage(page)) {
      problems.push(`${name}: browser error page`);
      continue;
    }
    try {
      await d.play(page);
    } catch {
      problems.push(`${name}: the title screen / PLAY did not work`);
      continue;
    }
    const now = await d.readSave(page);
    const strip = await page.locator(".ui-strip").innerText().catch(() => "");
    if (!now || now.seed !== 12345) problems.push(`${name}: not on the world seed after loading (${now?.seed})`);
    const moved = /universe|rebuilt|moved/i.test(await page.evaluate(() => document.body.innerText));
    if (/v1|another seed/.test(name) && !moved) problems.push(`${name}: no "universe rebuilt / moved" message`);
    if (/v1/.test(name) && now && now.state.credits <= st.credits) problems.push(`${name}: the old outpost was not refunded (credits ${st.credits} -> ${now.state.credits})`);
    if (!/CR/.test(strip)) problems.push(`${name}: no status strip`);
    problems.push(...noErrors(w, name));
    notes.push(`${name}: loaded, credits ${st.credits} -> ${now?.state.credits}, dock ${now?.state.currentDockId}`);
  }
  await context.close();
  return problems;
});

// ------------------------------------------------------------ 7
await check(7, "Stored copy wiped + offline: the friendly page, never the browser error (game and developer pages)", async (notes) => {
  const problems = [];
  const { context, page } = await freshInstalled();
  await page.evaluate(async () => {
    for (const n of await caches.keys()) await caches.delete(n);
  });
  await context.setOffline(true);
  for (const path of ["", "?speed=60", "debug.html", "game-debug.html", "models.html", "planets.html", "about.html"]) {
    await page.goto(server.url + path).catch(() => {});
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    if (await d.isBrowserErrorPage(page)) problems.push(`/${path || "(game)"}: the browser error page`);
    else if (!/offline|internet|connection/i.test(text)) problems.push(`/${path || "(game)"}: no friendly offline message (page says: "${text.slice(0, 80)}")`);
    else notes.push(`/${path || "(game)"}: friendly page ("${text.split("\n").filter(Boolean)[0]?.slice(0, 60)}")`);
  }
  await context.close();
  return problems;
});

// ------------------------------------------------------------ 8
await check(8, "Save file offline: export, wipe, import = same game; undo works; garbage refused", async (notes) => {
  const problems = [];
  const { context, page, w } = await freshInstalled(PHONE_UP);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(server.url).origin });
  await d.play(page);
  await d.acceptAndDeliver(page);
  await context.setOffline(true);
  await page.reload();
  await d.play(page);
  w.reset();
  const original = d.comparable(await d.readSave(page));
  // EXPORT: the text form (COPY TEXT)
  await d.openMenuPanel(page, "SAVE FILE");
  await d.clickButton(page, "COPY TEXT");
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (!text.startsWith("LFSAVE1:")) text = await page.locator("textarea.ui-savefile-text").first().inputValue().catch(() => "");
  if (!text.startsWith("LFSAVE1:")) problems.push("COPY TEXT gave no save text");
  notes.push(`exported text: ${text.length} characters`);
  // also the file download works offline
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), d.clickButton(page, /^SAVE FILE$/)]);
  if (!download) problems.push("SAVE FILE gave no download");
  else notes.push(`file: ${download.suggestedFilename()}`);
  // WIPE the save (like a new phone), reload offline = a new game
  await editStorage(page, () => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("lazy-freight.save")) localStorage.removeItem(key);
  });
  await d.play(page);
  const wiped = await d.readSave(page);
  if (wiped && wiped.state.credits === original.state.credits && wiped.state.currentDockId === original.state.currentDockId) problems.push("the wipe did not give a new game");
  // garbage refused
  const importText = async (t) => {
    await d.openMenuPanel(page, "SAVE FILE");
    await d.clickButton(page, "PASTE TEXT");
    await page.locator("textarea:visible").last().fill(t);
    await d.clickButton(page, "CHECK THIS TEXT");
    await page.waitForTimeout(400);
  };
  await importText("hello, this is not a save");
  const refusal = await page.locator(".ui-savefile-note").innerText().catch(() => "");
  if (!/not a Lazy Flight save/i.test(refusal)) problems.push(`garbage was not refused plainly (note: "${refusal.slice(0, 80)}")`);
  const afterGarbage = await d.readSave(page);
  if (JSON.stringify(d.comparable(afterGarbage)) !== JSON.stringify(d.comparable(wiped))) problems.push("garbage changed the save");
  await d.closeOverlays(page);
  await d.closeOverlays(page);
  // IMPORT the real text
  await importText(text);
  await d.clickButton(page, "REPLACE MY GAME");
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  await d.play(page);
  const imported = d.comparable(await d.readSave(page));
  if (JSON.stringify(imported) !== JSON.stringify(original)) problems.push("after import the game is not the same as the exported one");
  else notes.push("import gave back the identical game");
  // UNDO
  await d.openMenuPanel(page, "SAVE FILE");
  await d.clickButton(page, "UNDO LAST IMPORT");
  const confirm = page.locator("button:visible", { hasText: /^(UNDO|YES)/ }).last();
  if (await confirm.count()) await confirm.click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  await d.play(page);
  const undone = await d.readSave(page);
  if (undone.state.credits !== wiped.state.credits) problems.push(`undo did not bring back the game before the import (credits ${undone.state.credits}, want ${wiped.state.credits})`);
  else notes.push("undo brought back the game before the import");
  problems.push(...noErrors(w, "save file offline"));
  await context.close();
  return problems;
});

// ------------------------------------------------------------ K
await check("K", "Kill switch (pwa-mode retire): the helper clears its boxes, unregisters, the game loads from the network", async (notes) => {
  const problems = [];
  const { context, page } = await freshInstalled();
  server.setRoot(buildR);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0 && (await caches.keys()).length === 0, null, { timeout: 30000 }).catch(() => problems.push("the helper did not unregister and clear its boxes within 30 s"));
  await page.reload();
  await d.waitForTitle(page).catch(() => problems.push("the game did not load from the network after retiring"));
  await page.waitForTimeout(1500);
  const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  if (regs !== 0) problems.push("the helper registered again after retiring");
  notes.push(`after retiring: ${regs} helpers, ${(await page.evaluate(async () => (await caches.keys()).length))} boxes`);
  await context.close();
  server.setRoot(buildA);
  return problems;
});

// ------------------------------------------------------------ 9: summary
await browser.close();
await server.close();
if (!keep) rmSync(work, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log("\n==================== OFFLINE CHECK SUMMARY ====================");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}. ${r.name}`);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED. The offline app is NOT safe to publish.` : `\nAll ${results.length} checks passed. The offline app works.`);
process.exit(failed.length ? 1 : 0);
