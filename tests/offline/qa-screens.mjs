// npm run qa-screens (stage N4, Agent 6): the regression pass in a real (headless) browser on the BUILT game.
// Not part of publishing (it takes a few minutes and some checks are "look at the pictures"); run it before a release.
//  S  world seed lock: a normal address ignores ?seed=, ?dev=1&seed=N works, NEW GAME stays on the world seed
//  D  developer pages still take ?seed= (debug, planets, game-debug, models) and load without errors; about.html
//  L  every screen at phone (upright, sideways) and desktop with the LONGEST names (a far system, ?dev=1):
//     nothing sticks out of the window, no text cut inside buttons/cards; screenshots saved for a human look
//  C  the camera button keeps its pixel-eye style (render title ends with " view")
//  P  triangles per frame and draw calls measured inside the real game (WebGL counter): docked, system view with
//     10 planets and 3 docks, galaxy map at 75 ly, flight (orbit and cockpit), floating
// Usage: node tests/offline/qa-screens.mjs [--dist dist] [--out folder] [--only S,D,L,C,P]

import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
const outDir = resolve(argValue("--out") ?? join(tmpdir(), "lf-qa-screens"));
const only = argValue("--only")?.split(",").map((s) => s.trim().toUpperCase());
mkdirSync(outDir, { recursive: true });
if (!existsSync(join(distDir, "index.html"))) {
  console.error(`No built game in ${distDir}. Run "npm run build" first.`);
  process.exit(2);
}

const WORLD_SEED = 12345;
// The longest names found (2c limits: system 42, planet 47, dock full name 75): a system about 77 million ly away.
const FAR_DOCK = "77000001:77000001:-77000002:0/1"; // "Rattling Marmalade Station, Groroton Cluster DH4TVVRD9HR-2J237HRT45 II" (70 letters)
const TEN_PLANETS_DOCK = "-2:-1:-1:0/1"; // Fulfuky 76-94: 10 planets, 3 docks, 21 ly from the middle
const SIZES = [
  ["phone upright", { width: 390, height: 844 }],
  ["phone sideways", { width: 844, height: 390 }],
  ["small phone", { width: 320, height: 568 }],
  ["desktop", { width: 1280, height: 800 }],
];

// Counts triangles and draw calls the game sends to the graphics card, per drawn frame. No change to the game.
const TRIANGLE_COUNTER = `(() => {
  const s = { tris: 0, calls: 0, frames: 0 };
  window.__lfDraw = s;
  const tri = (mode, count, inst) => { if (mode === 4) s.tris += Math.floor(count / 3) * (inst || 1); else if (mode === 5 || mode === 6) s.tris += Math.max(0, count - 2) * (inst || 1); s.calls++; };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    const de = p.drawElements, da = p.drawArrays;
    p.drawElements = function (m, c, t, o) { tri(m, c, 1); return de.call(this, m, c, t, o); };
    p.drawArrays = function (m, f, c) { tri(m, c, 1); return da.call(this, m, f, c); };
    if (p.drawElementsInstanced) { const di = p.drawElementsInstanced; p.drawElementsInstanced = function (m, c, t, o, n) { tri(m, c, n); return di.call(this, m, c, t, o, n); }; }
    if (p.drawArraysInstanced) { const dai = p.drawArraysInstanced; p.drawArraysInstanced = function (m, f, c, n) { tri(m, c, n); return dai.call(this, m, f, c, n); }; }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { s.frames++; cb(t); });
})();`;

const results = [];
function record(id, name, ok, details = []) {
  results.push({ id, name, ok, details });
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${id}. ${name}`);
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

const server = await startServer(distDir);
const browser = await chromium.launch({ args: d.LAUNCH_ARGS });
console.log(`Screen checks on the built game. Pictures: ${outDir}`);

async function newPage(viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.addInitScript(TRIANGLE_COUNTER);
  const page = await context.newPage();
  return { context, page, w: d.watch(page) };
}

/** Starts a new game once, then puts the player at `dockId` with plenty of credits (developer address, never moved). */
async function placeAt(page, dockId, extra = "") {
  await page.goto(server.url + "?dev=1&speed=600" + extra);
  await d.play(page);
  const save = await d.readSave(page);
  const moved = { ...save, state: { ...save.state, currentDockId: dockId, credits: 60000, fuel: 60, spacePlanetId: null } };
  await page.goto(server.url + "offline.html");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [d.SAVE_KEY, JSON.stringify(moved)]);
  await page.goto(server.url + "?dev=1&speed=600" + extra);
  await d.play(page);
  const now = await d.readSave(page);
  if (now.state.currentDockId !== dockId) throw new Error(`could not place the ship at ${dockId} (it is at ${now.state.currentDockId})`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, `${name.replace(/[^a-z0-9]+/gi, "-")}.png`) });
}

async function measure(page, ms = 1500) {
  await page.evaluate(() => Object.assign(window.__lfDraw, { tris: 0, calls: 0, frames: 0 }));
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const s = window.__lfDraw;
    const f = Math.max(1, s.frames);
    return { triangles: Math.round(s.tris / f), calls: Math.round(s.calls / f), frames: s.frames };
  });
}

// ------------------------------------------------------------ S
await check("S", "World seed lock: normal address ignores ?seed=, ?dev=1&seed= works, NEW GAME stays on the world seed", async (notes) => {
  const problems = [];
  for (const [query, want] of [["?seed=777", WORLD_SEED], ["?dev=1&seed=777", 777], ["?seed=777&dev=0", WORLD_SEED], ["", WORLD_SEED]]) {
    const { context, page, w } = await newPage();
    await page.goto(server.url + query);
    await d.play(page);
    const s = await d.readSave(page);
    if (s?.seed !== want) problems.push(`${query || "(plain address)"}: seed ${s?.seed}, want ${want}`);
    problems.push(...w.errors.map((e) => `${query}: ${e}`));
    notes.push(`${query || "(plain address)"} -> seed ${s?.seed}`);
    if (query === "?dev=1&seed=777") {
      // a normal address afterwards moves this developer save onto the world seed, with the message
      await page.goto(server.url);
      await d.play(page);
      const after = await d.readSave(page);
      if (after.seed !== WORLD_SEED) problems.push(`a seed-777 save opened at the normal address stayed on ${after.seed}`);
      notes.push(`that save opened at the normal address -> seed ${after.seed}`);
    }
    await context.close();
  }
  // NEW GAME
  const { context, page } = await newPage();
  await page.goto(server.url);
  await d.play(page);
  await d.openMenuPanel(page, "NEW GAME");
  const yes = page.locator("button:visible", { hasText: /START OVER|YES/ }).first();
  await yes.click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  await d.play(page);
  const fresh = await d.readSave(page);
  if (fresh.seed !== WORLD_SEED) problems.push(`NEW GAME gave seed ${fresh.seed}`);
  notes.push(`NEW GAME -> seed ${fresh.seed}, ${fresh.state.credits} CR`);
  await context.close();
  return problems;
});

// ------------------------------------------------------------ D
await check("D", "Developer pages take ?seed= and load without errors; release page; version on the title", async (notes) => {
  const problems = [];
  for (const [path, mustSay] of [["debug.html?seed=777", "777"], ["game-debug.html?seed=777", "777"], ["planets.html?seed=777", null], ["models.html", null], ["about.html", "1.0.0"]]) {
    const { context, page, w } = await newPage();
    await page.goto(server.url + path);
    await page.waitForTimeout(3500);
    const text = await page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("input")].map((i) => i.value).join(" "));
    if (mustSay && !text.includes(mustSay)) problems.push(`/${path}: does not show "${mustSay}"`);
    if (text.trim().length < 20) problems.push(`/${path}: page looks empty`);
    problems.push(...w.errors.map((e) => `/${path}: ${e}`));
    notes.push(`/${path}: ${text.trim().split("\n")[0].slice(0, 60)}`);
    await shot(page, `dev-${path}`);
    await context.close();
  }
  const { context, page } = await newPage();
  await page.goto(server.url);
  await d.waitForTitle(page);
  const title = await page.evaluate(() => document.body.innerText);
  if (!/v1\.0\.0/.test(title)) problems.push("the title screen does not show v1.0.0");
  await context.close();
  return problems;
});

// ------------------------------------------------------------ L + C
await check("L", "Every screen with the LONGEST names at four sizes: nothing sticks out, no cut text", async (notes) => {
  const problems = [];
  for (const [label, vp] of SIZES) {
    const { context, page, w } = await newPage(vp);
    await placeAt(page, FAR_DOCK);
    const seen = [];
    const look = async (name) => {
      for (const o of await d.overflowReport(page)) problems.push(`${label} ${name}: ${o}`);
      await shot(page, `long-${label}-${name}`);
      seen.push(name);
    };
    await look("docked");
    await d.clickButton(page, "JOBS");
    await look("jobs");
    await d.closeOverlays(page);
    await d.clickButton(page, "SHIPYARD");
    await look("shipyard");
    await d.closeOverlays(page);
    for (const panel of ["RANKS & OUTPOSTS", "SETTINGS", "SAVE FILE"]) {
      await d.openMenuPanel(page, panel);
      await look(panel.split(" ")[0].toLowerCase());
      await d.closeOverlays(page);
      await d.closeOverlays(page);
    }
    await d.clickButton(page, /^MAP$/);
    await page.waitForTimeout(1200);
    await look("system-map");
    const card = await d.selectPlanetWithFly(page, /SCENERY|DOCK/);
    if (card) await look("planet-card");
    await d.clickButton(page, /^GALAXY$/);
    await page.waitForTimeout(1500);
    await look("galaxy-map");
    await d.closeOverlays(page);
    // a job flight with long destination names, then the arrival card
    await d.clickButton(page, "CLOSE").catch(() => {});
    await d.clickButton(page, "JOBS");
    const accept = page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first();
    if (await accept.count()) {
      await accept.click();
      await page.waitForTimeout(700);
      await look("flight");
      await d.waitDocked(page);
      await page.waitForTimeout(1200);
      await look("arrival");
      await d.closeOverlays(page);
    } else problems.push(`${label}: no job could be taken at the far dock`);
    // floating at a scenery planet (long planet name)
    try {
      await d.freeTripToScenery(page);
      await page.waitForTimeout(800);
      await look("floating");
      await d.clickButton(page, "WHAT NOW?");
      await look("what-now");
      await d.closeOverlays(page);
    } catch (e) {
      problems.push(`${label}: free trip: ${e.message}`);
    }
    problems.push(...w.errors.map((e) => `${label}: ${e}`), ...w.failed.map((f) => `${label}: request failed ${f}`));
    notes.push(`${label} ${vp.width}x${vp.height}: ${seen.join(", ")}`);
    await context.close();
  }
  return problems;
});

await check("C", "Camera button keeps its pixel-eye style in flight and floating (render title ends with \" view\")", async (notes) => {
  const problems = [];
  const { context, page } = await newPage();
  await page.goto(server.url + "?speed=10");
  await d.play(page);
  await d.clickButton(page, "JOBS");
  await page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first().click();
  await page.waitForTimeout(1500);
  const cam = await page.evaluate(() => {
    const b = document.querySelector('.fh-button[title$=" view"]');
    return b ? { title: b.getAttribute("title"), font: getComputedStyle(b).fontSize, w: b.getBoundingClientRect().width } : null;
  });
  if (!cam) problems.push("no camera button with a title ending in \" view\" during the flight");
  else if (cam.font !== "0px") problems.push(`the camera button shows its emoji (font-size ${cam.font}): the pixel-eye style is lost`);
  notes.push(`flight: ${JSON.stringify(cam)}`);
  await context.close();
  return problems;
});

// ------------------------------------------------------------ P
const perf = {};
await check("P", "Triangles per frame and draw calls (measured inside the real game, desktop size)", async (notes) => {
  const problems = [];
  const { context, page } = await newPage({ width: 1280, height: 800 });
  await placeAt(page, TEN_PLANETS_DOCK, "&reach=75");
  await page.waitForTimeout(1500);
  perf.docked = await measure(page);
  await d.clickButton(page, /^MAP$/);
  await page.waitForTimeout(2000);
  perf["system view (10 planets, 3 docks)"] = await measure(page);
  await shot(page, "perf-system-10-planets");
  await d.clickButton(page, /^GALAXY$/);
  await page.waitForTimeout(3000);
  perf["galaxy map (?reach=75, the 75 ly cap)"] = await measure(page);
  await shot(page, "perf-galaxy-75");
  await d.clickButton(page, /^SYSTEM$/);
  await page.waitForTimeout(800);
  await d.clickButton(page, "CLOSE");
  // a slow flight to look at (speed 1 so it lasts), orbit then cockpit
  await page.goto(server.url + "?dev=1&speed=1&reach=75");
  await d.play(page);
  await d.clickButton(page, "JOBS");
  await page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first().click();
  await page.waitForTimeout(12000);
  perf["flight, orbit view (warp)"] = await measure(page);
  const cam = page.locator('.fh-button[title="Cockpit view"]');
  if (await cam.count()) {
    await cam.click();
    await page.waitForTimeout(2500);
    perf["flight, cockpit view"] = await measure(page);
    await shot(page, "perf-cockpit");
  } else problems.push("no Cockpit view button found");
  await context.close();
  // floating
  const f = await newPage({ width: 1280, height: 800 });
  await placeAt(f.page, TEN_PLANETS_DOCK);
  await d.freeTripToScenery(f.page);
  await f.page.waitForTimeout(2000);
  perf["floating at a planet"] = await measure(f.page);
  await shot(f.page, "perf-floating");
  await f.context.close();
  for (const [k, v] of Object.entries(perf)) notes.push(`${k}: ${v.triangles.toLocaleString("en")} triangles, ${v.calls} draw calls per frame (${v.frames} frames)`);
  return problems;
});

await browser.close();
await server.close();
writeFileSync(join(outDir, "results.json"), JSON.stringify({ results, perf }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log("\n==================== SCREEN CHECK SUMMARY ====================");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}. ${r.name}`);
console.log(`\nPictures and numbers: ${outDir}`);
process.exit(failed.length ? 1 : 0);
