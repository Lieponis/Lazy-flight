// Helpers that PLAY the real built game in a headless browser, like a person tapping: PLAY, JOBS, ACCEPT,
// SHIPYARD paint, MAP and a planet (found on a screenshot), FLY HERE, MENU panels. Used by the offline checks and
// the screen checks. No hidden test hooks in the game: everything goes through the screen.

import { decodePng, findBlobs } from "./png.mjs";

export const SAVE_KEY = "lazy-freight.save";

/** Browser options: software 3D so the game's WebGL runs on any machine. */
export const LAUNCH_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

/** Watches a page: page errors, console errors, failed requests, and every request that went to the network. */
export function watch(page) {
  const w = { errors: [], failed: [], network: [] };
  page.on("pageerror", (e) => w.errors.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") w.errors.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => w.failed.push(`${r.url()} (${r.failure()?.errorText ?? "?"})`));
  page.on("request", (r) => {
    if (!r.url().startsWith("data:") && !r.url().startsWith("blob:")) w.network.push(r.url());
  });
  w.reset = () => {
    w.errors.length = 0;
    w.failed.length = 0;
    w.network.length = 0;
  };
  return w;
}

/** True if the browser shows its own error page ("This site can't be reached"). */
export async function isBrowserErrorPage(page) {
  if (page.url().startsWith("chrome-error://")) return true;
  const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  return /can.t be reached|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|No internet/i.test(text);
}

export async function waitForTitle(page, timeout = 20000) {
  await page.waitForSelector(".ui-title-play", { timeout });
  await page.waitForTimeout(400);
}

/** Title screen -> PLAY -> docked (or floating/flying, wherever the save is). */
export async function play(page) {
  await waitForTitle(page);
  await page.click(".ui-title-play");
  await page.waitForTimeout(1200);
}

export async function readSave(page) {
  const text = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  return text ? JSON.parse(text) : null;
}

/** The parts of a save that must stay identical across a reload (clock fields removed). */
export function comparable(save) {
  if (!save) return null;
  const { savedAtRealMs: _a, gameNowMs: _b, ...rest } = save;
  void _a;
  void _b;
  const state = { ...rest.state };
  delete state.travelStartMs;
  delete state.travelEndMs;
  return { ...rest, state };
}

export async function clickButton(page, text, timeout = 5000) {
  const b = page.locator("button:visible", { hasText: text }).first();
  try {
    await b.click({ timeout });
  } catch {
    const shown = await page.$$eval("button", (bs) => bs.filter((x) => x.offsetParent).map((x) => x.textContent.trim()).filter(Boolean)).catch(() => []);
    throw new Error(`could not tap the "${text}" button (buttons on screen: ${shown.slice(0, 12).join(" / ")})`);
  }
  await page.waitForTimeout(350);
}

export async function closeOverlays(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  for (const t of ["DISMISS", "CLOSE", "BACK"]) {
    const b = page.locator("button:visible", { hasText: new RegExp(`^${t}$`) }).first();
    if (await b.count()) await b.click().catch(() => {});
  }
  await page.waitForTimeout(250);
}

/** Waits until the save says: docked, no job, no free trip (a trip at ?speed= high is over in seconds). */
export async function waitDocked(page, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await readSave(page);
    if (s && s.state && !s.state.currentJob && !s.state.freeTrip) return s;
    await page.waitForTimeout(500);
  }
  throw new Error("the trip did not end in time");
}

/** JOBS -> the first ACCEPT that works -> waits for landing -> DISMISS the arrival card. Returns the job's reward. */
export async function acceptAndDeliver(page) {
  await clickButton(page, "JOBS");
  let accept = page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first();
  if (!(await accept.count())) {
    // Not enough fuel for any job: buy fuel (as a player would) and look again.
    const refuel = page.locator("button:visible:not([disabled])", { hasText: /^REFUEL/ }).first();
    if (await refuel.count()) {
      await refuel.click();
      await page.waitForTimeout(500);
    }
    accept = page.locator("button:visible:not([disabled])", { hasText: /^ACCEPT/ }).first();
  }
  if (!(await accept.count())) throw new Error("no job could be accepted (even after refuelling)");
  const before = (await readSave(page)).state.credits;
  await accept.click();
  await page.waitForTimeout(800);
  const flying = await readSave(page);
  if (!flying.state.currentJob) throw new Error("ACCEPT did not start a job");
  await waitDocked(page);
  await page.waitForTimeout(1500);
  const dismiss = page.locator("button:visible", { hasText: "DISMISS" }).first();
  if (await dismiss.count()) await dismiss.click();
  await page.waitForTimeout(400);
  const after = (await readSave(page)).state.credits;
  if (after <= before) throw new Error(`no pay after delivery (${before} -> ${after})`);
  return after - before;
}

/** SHIPYARD -> PAINT on the active ship -> first BUY · 500 CR -> LATER (do not wear). Returns the paint id bought. */
export async function buyPaintJob(page) {
  await clickButton(page, "SHIPYARD");
  await clickButton(page, /^PAINT /);
  const buy = page.locator("button:visible:not([disabled])", { hasText: /^BUY · 500/ }).first();
  if (!(await buy.count())) throw new Error("no paint job to buy");
  const before = (await readSave(page)).state.shipLiveries ?? {};
  await buy.click();
  await page.waitForTimeout(500);
  await clickButton(page, "WEAR NOW");
  await closeOverlays(page);
  const after = (await readSave(page)).state.shipLiveries ?? {};
  if (JSON.stringify(after) === JSON.stringify(before)) throw new Error("the paint job was not saved");
  return after;
}

/** On the system map: finds planets on a screenshot and taps them until one shows a card with FLY HERE. */
export async function selectPlanetWithFly(page, wanted = /SCENERY/) {
  const size = page.viewportSize();
  const img = decodePng(await page.screenshot());
  const scale = img.width / size.width;
  const blobs = findBlobs(img, (x, y) => y < 70 * scale || y > size.height * scale - 140 * scale).map((b) => ({ x: b.x / scale, y: b.y / scale }));
  const centre = { x: size.width / 2, y: size.height / 2 };
  for (const b of blobs) {
    if (Math.hypot(b.x - centre.x, b.y - centre.y) < 20) continue; // the star
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(700);
    const text = await page.$eval(".ui-planet", (e) => (e.hidden ? "" : e.innerText)).catch(() => "");
    if (wanted.test(text) && /FLY HERE/.test(text)) return text;
    await page.mouse.click(8, size.height / 2); // empty space: back to the star view
    await page.waitForTimeout(500);
  }
  return null;
}

/** MAP -> a scenery planet -> FLY HERE -> waits until floating there. Returns the save after arrival. */
export async function freeTripToScenery(page) {
  await clickButton(page, /^MAP$/);
  await page.waitForTimeout(800);
  // the map remembers its last tab: make sure it shows this star system, not the galaxy
  const systemTab = page.locator("button:visible", { hasText: /^SYSTEM$/ }).first();
  if (await systemTab.count()) await systemTab.click();
  await page.waitForTimeout(1200);
  const card = await selectPlanetWithFly(page, /SCENERY/);
  if (!card) throw new Error("no scenery planet with FLY HERE found on the system map");
  await clickButton(page, "FLY HERE");
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    const s = await readSave(page);
    if (s.state.spacePlanetId && !s.state.freeTrip) {
      await page.waitForTimeout(2000);
      const dismiss = page.locator("button:visible", { hasText: "DISMISS" }).first();
      if (await dismiss.count()) await dismiss.click();
      return s;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("the free trip did not arrive");
}

/** MENU -> a panel ("RANKS & OUTPOSTS", "SETTINGS", "SAVE FILE"). */
export async function openMenuPanel(page, name) {
  await page.click(".ui-strip-menu", { timeout: 5000 }).catch(() => {
    throw new Error("could not tap MENU");
  });
  await page.waitForTimeout(400);
  await clickButton(page, name);
}

/** A rough "does anything stick out of the window" check: the page must not scroll sideways. */
export async function overflowReport(page) {
  return page.evaluate(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out = [];
    if (document.documentElement.scrollWidth > w + 1) out.push(`page wider than the window (${document.documentElement.scrollWidth} > ${w})`);
    for (const el of document.querySelectorAll("button, .ui-strip, .ui-card, .ui-panel, .ui-planet, .lf-update")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (r.right > w + 1 || r.left < -1) out.push(`${el.className || el.tagName} sticks out sideways (${Math.round(r.left)}..${Math.round(r.right)} of ${w})`);
      if (el.scrollWidth > el.clientWidth + 2 && style.overflowX !== "auto" && style.overflowX !== "scroll") {
        out.push(`${el.className || el.tagName} text cut (${el.scrollWidth} > ${el.clientWidth}): "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      }
    }
    void h;
    return [...new Set(out)];
  });
}
