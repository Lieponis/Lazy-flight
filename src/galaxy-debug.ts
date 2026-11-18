import "./previewboot"; // KEEP THIS FIRST: it must run before any other code reads the save box (src/previewboot.ts)
// The galaxy prototype page (galaxy-debug.html). Shows the G1 galaxy generator as pictures and tables.
// It only READS from src/universe (the galaxy and the names). It does not touch the game.

import {
  BULGE,
  BULGE_OPTIONS,
  DISC_RADIUS,
  START_POINT,
  cellTable,
  decodeSystemNumber,
  densityAt,
  expectedTotal,
  findSystemById,
  galaxyChecksum,
  lineIntegralDensity,
  nearestSystems,
  spacingAt,
  systemsWithin,
  thicknessAt,
  encodeSystemNumber,
  VERTICAL_AREA,
  expectedBulgeTotal,
  type BulgeShape,
  type Vec3,
} from "./universe/galaxy";
import { getSystem, pureNameCount } from "./universe";

/** The names of a system by its number (word, code, whether it is a pure name). */
function systemName(seed: number | string, id: number): { name: string; word: string; code: string; isPure: boolean } {
  const system = getSystem(seed, id);
  if (!system) return { name: "?", word: "?", code: encodeSystemNumber(id), isPure: false };
  return { name: system.name, word: system.baseName, code: system.code, isPure: system.isPure };
}

const SEED = 12345;

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`galaxy-debug.html is missing #${id}`);
  return found as T;
}

function esc(text: string | number): string {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function big(n: number): string {
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : Math.round(n).toLocaleString("en");
}

/** A warm colour for a number between 0 and 1 (black, blue, magenta, orange, white). */
function colour(v: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, v));
  const stops: [number, number, number, number][] = [
    [0, 0, 0, 12],
    [0.25, 30, 40, 140],
    [0.5, 170, 50, 150],
    [0.75, 255, 150, 60],
    [1, 255, 250, 225],
  ];
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i] as [number, number, number, number];
    const a = stops[i - 1] as [number, number, number, number];
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  return [255, 250, 225];
}

function startRadius(): number {
  return Math.hypot(START_POINT.x, START_POINT.z);
}

// The value the computer gives (pinned in tests/galaxy2.test.ts). Every device must show the same.
const PINNED_CHECKSUM = "d0019075";

function renderChecksumBanner(): void {
  const banner = el("checksumBanner");
  const sum = galaxyChecksum(SEED, START_POINT, 2000);
  const ok = sum === PINNED_CHECKSUM;
  banner.className = "ckbanner " + (ok ? "ok" : "fail");
  banner.textContent =
    `Checksum of the 2,000 nearest systems at the start: ${sum} ` +
    (ok ? `(matches the expected ${PINNED_CHECKSUM}: OK)` : `(DOES NOT MATCH the expected ${PINNED_CHECKSUM})`);
}

// 1. Facts
function renderFacts(): void {
  const table = cellTable();
  const total = expectedTotal();
  const start = nearestSystems(SEED, START_POINT, 1)[0];
  const startName = start ? systemName(SEED, start.id) : null;
  const rows: [string, string][] = [
    ["Systems in the galaxy (adding up the density)", `${big(total)} (${Math.round(total).toLocaleString("en")})`],
    ["Cells (the pieces the galaxy is cut into, none stored)", `${big(table.totalCells)} in ${table.slabs.length.toLocaleString("en")} rings, ${table.slots} slots each`],
    ["System numbers", `0 to ${big(table.idSpace)}; codes have 4 to 9 symbols (almost all 9)`],
    ["Pure names (no code) that found a system", `${pureNameCount(SEED).toLocaleString("en")}, all within about 150 ly of the start`],
    ["Where the player starts", `${startRadius().toFixed(0)} ly from the centre, x ${START_POINT.x.toFixed(0)}, z ${START_POINT.z.toFixed(0)}, on the edge of a spiral arm`],
    ["Checksum of the 2,000 nearest systems to the start (must be identical on every phone and browser)", `<b>${galaxyChecksum(SEED, START_POINT, 2000)}</b>`],
    ["Nearest system to the start point", startName && start ? `${esc(startName.name)} (system number ${start.id}), ${start.distance.toFixed(1)} ly from the point` : "none"],
  ];
  el("facts").innerHTML = `<table>${rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${b}</td></tr>`).join("")}</table>`;
}

// 2. Top view
function drawTop(): void {
  const canvas = el<HTMLCanvasElement>("top");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const n = canvas.width;
  const image = ctx.createImageData(n, n);
  const scale = (2 * DISC_RADIUS) / n;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) * scale - DISC_RADIUS;
      const z = (py + 0.5) * scale - DISC_RADIUS;
      const r = Math.hypot(x, z);
      let v = 0;
      if (r < DISC_RADIUS) {
        const column = densityAt({ x, y: 0, z }) * VERTICAL_AREA * thicknessAt(r);
        v = column > 0 ? (Math.log10(column) + 4.2) / 6.6 : 0;
      }
      const [cr, cg, cb] = colour(v);
      const o = (py * n + px) * 4;
      image.data[o] = cr;
      image.data[o + 1] = cg;
      image.data[o + 2] = cb;
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const sx = (START_POINT.x + DISC_RADIUS) / scale;
  const sz = (START_POINT.z + DISC_RADIUS) / scale;
  ctx.strokeStyle = "#7CFC00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sz, 9, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#7CFC00";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("start", sx + 12, sz + 5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(n / 2 - 2, n / 2 - 2, 4, 4);
}

// 3. Side view (every pixel adds up the density along the line of sight through the disc, in three pieces so the
// crowded middle gets small steps)
function drawSide(): void {
  const canvas = el<HTMLCanvasElement>("side");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const stretch = 12;
  const scaleX = (2 * DISC_RADIUS) / w;
  const scaleY = scaleX / stretch;
  const values = new Float64Array(w * h);
  let row = 0;
  const finish = (): void => {
    let max = 0;
    for (const v of values) if (v > max) max = v;
    const image = ctx.createImageData(w, h);
    for (let i = 0; i < values.length; i++) {
      const v = (values[i] as number) > 0 ? (Math.log10(values[i] as number) - (Math.log10(max) - 4.5)) / 4.5 : 0;
      const [cr, cg, cb] = colour(v);
      image.data[i * 4] = cr;
      image.data[i * 4 + 1] = cg;
      image.data[i * 4 + 2] = cb;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  };
  const step = (): void => {
    const until = Math.min(h, row + 4);
    for (; row < until; row++) {
      const y = (h / 2 - row - 0.5) * scaleY;
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) * scaleX - DISC_RADIUS;
        const far = DISC_RADIUS - 5000;
        values[row * w + px] =
          lineIntegralDensity({ x, y, z: -DISC_RADIUS }, { x: 0, y: 0, z: 1 }, far, 80) +
          lineIntegralDensity({ x, y, z: -5000 }, { x: 0, y: 0, z: 1 }, 10000, 100) +
          lineIntegralDensity({ x, y, z: 5000 }, { x: 0, y: 0, z: 1 }, far, 80);
      }
    }
    finish();
    if (row < h) setTimeout(step, 0);
  };
  step();
}

// 4. Spacing table
function renderSpacing(): void {
  const rows: string[] = [];
  for (const r of [0, 1000, 5000, 16667, 30000, 50000]) {
    const edge = Math.min(r, DISC_RADIUS - 500);
    const sample = nearestSystems(SEED, { x: edge, y: 0, z: 0 }, 300);
    let sum = 0;
    const checked = Math.min(150, sample.length);
    for (let i = 0; i < checked; i++) {
      let best = Infinity;
      for (let j = 0; j < sample.length; j++) {
        if (i === j) continue;
        const a = sample[i] as { x: number; y: number; z: number };
        const b = sample[j] as { x: number; y: number; z: number };
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d < best) best = d;
      }
      sum += best;
    }
    rows.push(
      `<tr><td>${r.toLocaleString("en")}</td><td>${spacingAt(r).toFixed(2)}</td><td>${thicknessAt(r).toFixed(0)}</td><td>${(sum / checked).toFixed(2)}</td><td>${sample[sample.length - 1]?.distance.toFixed(0) ?? "-"}</td></tr>`,
    );
  }
  el("spacing").innerHTML = `<table><tr><th>Distance from the centre (ly)</th><th>Spacing, average (ly)</th><th>Disc thickness (ly)</th><th>Measured: distance to the nearest neighbour (ly)</th><th>The nearest 300 systems reach (ly)</th></tr>${rows.join("")}</table>
    <p class="note">In the middle of a spiral arm the spacing is about 17 % smaller than the average, between arms about 60 % larger. The neighbour distance is smaller than the spacing because a neighbour is always the closest of several.</p>`;
}

// 5. Near the start
function drawNear(): void {
  const radius = Math.min(120, Math.max(10, Number((el("nearRadius") as HTMLInputElement).value) || 60));
  const t = performance.now();
  const found = systemsWithin(SEED, START_POINT, radius);
  const ms = performance.now() - t;
  const canvas = el<HTMLCanvasElement>("near");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const n = canvas.width;
  ctx.fillStyle = "#000010";
  ctx.fillRect(0, 0, n, n);
  const scale = (n / 2 - 8) / radius;
  for (const s of found) {
    const x = n / 2 + (s.x - START_POINT.x) * scale;
    const z = n / 2 + (s.z - START_POINT.z) * scale;
    const high = Math.max(-1, Math.min(1, s.y / (radius * 0.5)));
    ctx.fillStyle = high < 0 ? `rgb(${120 + high * 40},${170 + high * 60},255)` : `rgb(255,${220 - high * 90},${190 - high * 120})`;
    ctx.fillRect(x - 1, z - 1, 2, 2);
  }
  ctx.strokeStyle = "#7CFC00";
  ctx.beginPath();
  ctx.arc(n / 2, n / 2, 7, 0, 2 * Math.PI);
  ctx.stroke();
  const pure = found.filter((s) => systemName(SEED, s.id).isPure).length;
  el("nearText").innerHTML = `<p>${found.length.toLocaleString("en")} systems within ${radius} ly of the start point (found in ${ms.toFixed(1)} ms), seen from above; blue = below the disc plane, orange = above. ${pure} of them have a pure name (no code).</p>`;
}

// 6. Sky
function skyPlace(name: string): Vec3 {
  const r = startRadius();
  const dir = { x: START_POINT.x / r, z: START_POINT.z / r };
  switch (name) {
    case "mid":
      return { x: dir.x * 30000, y: 0, z: dir.z * 30000 };
    case "inner":
      return { x: dir.x * 1500, y: 0, z: dir.z * 1500 };
    case "rim":
      return { x: dir.x * 49000, y: 0, z: dir.z * 49000 };
    case "above":
      return { x: START_POINT.x, y: 4000, z: START_POINT.z };
    default:
      return START_POINT;
  }
}

function drawSky(): void {
  const canvas = el<HTMLCanvasElement>("sky");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const origin = skyPlace((el("skyPlace") as HTMLSelectElement).value);
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.createImageData(w, h);
  const t = performance.now();
  const values = new Float64Array(w * h);
  let max = 0;
  for (let py = 0; py < h; py++) {
    const lat = (0.5 - (py + 0.5) / h) * Math.PI;
    for (let px = 0; px < w; px++) {
      const lon = ((px + 0.5) / w - 0.5) * 2 * Math.PI;
      const dir = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      const sum = lineIntegralDensity(origin, dir, 70000, 96);
      values[py * w + px] = sum;
      if (sum > max) max = sum;
    }
  }
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] as number) > 0 ? (Math.log10(values[i] as number) - (Math.log10(max) - 3.5)) / 3.5 : 0;
    const [cr, cg, cb] = colour(v);
    image.data[i * 4] = cr;
    image.data[i * 4 + 1] = cg;
    image.data[i * 4 + 2] = cb;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const ms = performance.now() - t;
  el("skyText").textContent = `${(w * h).toLocaleString("en")} lines of sight x 96 steps drawn in ${ms.toFixed(0)} ms. Brightest line adds up to ${max.toFixed(1)} systems per square light year.`;
}

// 7. Find by code
function findByCode(): void {
  const text = (el("codeBox") as HTMLInputElement).value;
  const id = decodeSystemNumber(text);
  if (id === null) {
    el("codeOut").innerHTML = `<p class="bad">"${esc(text)}" is not a code (4 to 9 symbols from 2-9 D H J M N P R T V).</p>`;
    return;
  }
  const system = findSystemById(SEED, id);
  if (!system) {
    el("codeOut").innerHTML = `<p class="bad">The code is valid (system number ${id}) but no system sits in that slot.</p>`;
    return;
  }
  const name = systemName(SEED, id);
  el("codeOut").innerHTML = `<p class="good">${esc(name.name)}</p><p>System number ${id}, code ${esc(encodeSystemNumber(id))}, ${name.isPure ? "pure name" : "word + code"}.<br />Position x ${system.x.toFixed(1)}, y ${system.y.toFixed(1)}, z ${system.z.toFixed(1)} ly (${Math.hypot(system.x, system.z).toFixed(0)} ly from the centre).</p>`;
}

// 8. Timings
function runTimings(): void {
  const places: [string, Vec3][] = [
    ["centre", { x: 0, y: 0, z: 0 }],
    ["start region", START_POINT],
    ["middle (30,000 ly)", { x: 30000, y: 0, z: 0 }],
    ["rim (49,000 ly)", { x: 49000, y: 0, z: 0 }],
  ];
  const time = (f: () => unknown): string => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      f();
      times.push(performance.now() - t);
    }
    return `${(times[0] as number).toFixed(0)} / ${Math.min(...times).toFixed(0)}`;
  };
  const rows: string[] = [];
  for (const [name, p] of places) {
    rows.push(
      `<tr><td>${esc(name)}</td><td>${time(() => nearestSystems(SEED, p, 1000))}</td><td>${time(() => nearestSystems(SEED, p, 10000))}</td><td>${time(() => nearestSystems(SEED, p, 60000))}</td><td>${time(() => systemsWithin(SEED, p, 80))}</td></tr>`,
    );
  }
  el("timings").innerHTML = `<table><tr><th>Where</th><th>nearest 1,000 (ms)</th><th>nearest 10,000 (ms)</th><th>nearest 60,000 (ms)</th><th>everything within 80 ly (ms)</th></tr>${rows.join("")}</table>
    <p class="note">first run / best of five. Near the centre "within 80 ly" holds about 360,000 systems, which the game would never ask for (it asks for the nearest N).</p>`;
}

// 0. Bulge options (stage G7): A, B, C compared with today's galaxy, side view and sky from five places.
const NO_BULGE: BulgeShape = { radius: 1, flatten: 1, scale: 1, peak: 0 };
const SKY_PLACES: { label: string; at: () => Vec3 }[] = [
  { label: "In the middle (1,500 ly from the centre)", at: () => skyPlace("inner") },
  { label: "10,000 ly out", at: () => ({ x: (START_POINT.x / startRadius()) * 10000, y: 0, z: (START_POINT.z / startRadius()) * 10000 }) },
  { label: "At the start (16,500 ly out)", at: () => START_POINT },
  { label: "Half-way to the rim (30,000 ly out)", at: () => skyPlace("mid") },
  { label: "Above the start (4,000 ly up)", at: () => skyPlace("above") },
];

/** Sky value for one direction: three pieces so the crowded middle gets small steps. */
function skyValue(origin: Vec3, dir: Vec3, shape: BulgeShape): number {
  const at = (d: number): Vec3 => ({ x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d });
  return lineIntegralDensity(at(0), dir, 6000, 48, shape) + lineIntegralDensity(at(6000), dir, 14000, 28, shape) + lineIntegralDensity(at(20000), dir, 50000, 28, shape);
}

function drawOptionSide(canvas: HTMLCanvasElement, shape: BulgeShape, max: { value: number }): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const half = 12000;
  const scale = (2 * half) / w; // the same scale sideways and up: no stretching at all
  const values = new Float64Array(w * h);
  let peak = 0;
  for (let row = 0; row < h; row++) {
    const y = (h / 2 - row - 0.5) * scale;
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5) * scale - half;
      const v = lineIntegralDensity({ x, y, z: -half }, { x: 0, y: 0, z: 1 }, 2 * half, 120, shape);
      values[row * w + px] = v;
      if (v > peak) peak = v;
    }
  }
  if (max.value === 0) max.value = peak; // the "today" picture sets the colour scale for the others
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] as number) > 0 ? (Math.log10(values[i] as number) - (Math.log10(max.value) - 3.2)) / 3.2 : 0;
    const [cr, cg, cb] = colour(v);
    image.data[i * 4] = cr;
    image.data[i * 4 + 1] = cg;
    image.data[i * 4 + 2] = cb;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function drawOptionSky(canvas: HTMLCanvasElement, origin: Vec3, shape: BulgeShape, max: { value: number }): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const values = new Float64Array(w * h);
  let peak = 0;
  for (let py = 0; py < h; py++) {
    const lat = (0.5 - (py + 0.5) / h) * Math.PI;
    for (let px = 0; px < w; px++) {
      const lon = ((px + 0.5) / w - 0.5) * 2 * Math.PI;
      const v = skyValue(origin, { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) }, shape);
      values[py * w + px] = v;
      if (v > peak) peak = v;
    }
  }
  if (max.value === 0) max.value = peak;
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] as number) > 0 ? (Math.log10(values[i] as number) - (Math.log10(max.value) - 3.2)) / 3.2 : 0;
    const [cr, cg, cb] = colour(v);
    image.data[i * 4] = cr;
    image.data[i * 4 + 1] = cg;
    image.data[i * 4 + 2] = cb;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function renderBulgeOptions(): void {
  const host = el("bulgeOptions");
  const rows: { key: string; title: string; shape: BulgeShape; note: string }[] = [
    { key: "none", title: "Today (no bulge)", shape: NO_BULGE, note: "the galaxy as it was before this stage; the colour scale of the other rows is taken from this row" },
    ...(["A", "B", "C"] as const).map((k) => {
      const s = BULGE_OPTIONS[k];
      const name = k === "A" ? "small" : k === "B" ? "medium" : "large";
      return {
        key: k,
        title: `${k}: ${name} bulge`,
        shape: s,
        note: `radius ${s.radius.toLocaleString("en")} ly, ${(2 * s.radius * s.flatten).toLocaleString("en")} ly tall, adds about ${big(expectedBulgeTotal(s))} systems${s === BULGE ? " (this one is built in for now)" : ""}`,
      };
    }),
  ];
  host.innerHTML = rows
    .map(
      (r) =>
        `<h3>${esc(r.title)}</h3><p class="note">${esc(r.note)}</p><canvas id="bo-side-${r.key}" width="160" height="80" style="width: 100%; max-width: 640px; image-rendering: pixelated"></canvas>
        <div class="skygrid">${SKY_PLACES.map((p, i) => `<figure><canvas id="bo-sky-${r.key}-${i}" width="120" height="30" style="width: 100%; image-rendering: pixelated"></canvas><figcaption>${esc(p.label)}</figcaption></figure>`).join("")}</div>`,
    )
    .join("");
  const sideMax = { value: 0 };
  const skyMax = SKY_PLACES.map(() => ({ value: 0 }));
  const jobs: (() => void)[] = [];
  for (const r of rows) {
    jobs.push(() => drawOptionSide(el<HTMLCanvasElement>(`bo-side-${r.key}`), r.shape, sideMax));
    SKY_PLACES.forEach((p, i) => jobs.push(() => drawOptionSky(el<HTMLCanvasElement>(`bo-sky-${r.key}-${i}`), p.at(), r.shape, skyMax[i] as { value: number })));
  }
  let next = 0;
  const status = el("bulgeStatus");
  const run = (): void => {
    const job = jobs[next++];
    if (job) job();
    status.textContent = next < jobs.length ? `Drawing picture ${next} of ${jobs.length}... (they appear one by one)` : "All pictures drawn.";
    if (next < jobs.length) setTimeout(run, 0);
  };
  run();
}

renderChecksumBanner();
renderFacts();
setTimeout(renderBulgeOptions, 0);
drawTop();
renderSpacing();
drawNear();
setTimeout(drawSide, 0);
setTimeout(drawSky, 0);
el("nearGo").addEventListener("click", drawNear);
el("skyGo").addEventListener("click", () => setTimeout(drawSky, 0));
el("codeGo").addEventListener("click", findByCode);
el("timeGo").addEventListener("click", () => {
  el("timings").innerHTML = "<p>Working...</p>";
  setTimeout(runTimings, 20);
});
