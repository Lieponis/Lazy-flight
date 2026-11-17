// Numbers for the G1 report. Run: npx tsx scripts/galaxy2-bench.ts   (prints plain text tables)
import {
  DISC_RADIUS,
  START_POINT,
  cellTable,
  countInCell,
  decodeSystemNumber,
  densityAt,
  encodeSystemNumber,
  expectedTotal,
  lineIntegralDensity,
  nearestSystems,
  spacingAt,
  systemsOfCell,
  systemsWithin,
  type Vec3,
} from "../src/universe/galaxy";
import { getSystem, pureNameCount } from "../src/universe";

/** Names of a system by number (the names live in src/universe since G3). */
function systemName(seed: number, id: number): { name: string; isPure: boolean } {
  const system = getSystem(seed, id);
  return { name: system ? system.name : "?", isPure: system ? system.isPure : false };
}

const SEED = 12345;
const places: [string, Vec3][] = [
  ["centre", { x: 0, y: 0, z: 0 }],
  ["start region", START_POINT],
  ["middle (30,000 ly)", { x: 30000, y: 0, z: 0 }],
  ["rim (49,000 ly)", { x: 49000, y: 0, z: 0 }],
];

function ms(f: () => unknown, runs = 5): { cold: number; median: number } {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    f();
    times.push(performance.now() - t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { cold: times[0] as number, median: sorted[Math.floor(sorted.length / 2)] as number };
}

function lcg(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

const table = cellTable();
console.log(`Cell table: ${table.slabs.length} rings, ${table.totalCells.toExponential(3)} cells, ${table.slots} slots per cell, system numbers below ${table.idSpace.toExponential(3)}`);
console.log(`Expected total by integration: ${expectedTotal().toExponential(4)}`);

// Total by sampling cells.
{
  const rnd = lcg(99);
  const n = 400000;
  let sum = 0;
  let sumSq = 0;
  const t = performance.now();
  for (let i = 0; i < n; i++) {
    const c = countInCell(SEED, Math.floor(rnd() * table.totalCells));
    sum += c;
    sumSq += c * c;
  }
  const mean = sum / n;
  const sd = Math.sqrt(sumSq / n - mean * mean);
  const est = mean * table.totalCells;
  console.log(`Total by sampling ${n} random cells: ${est.toExponential(4)} (1 standard error ${(((sd / Math.sqrt(n)) / mean) * 100).toFixed(2)} %); difference to integral ${(((est / expectedTotal()) - 1) * 100).toFixed(2)} %; ${((performance.now() - t) / n * 1000).toFixed(2)} microseconds per cell`);
  console.log(`Average systems per cell: ${mean.toFixed(3)}`);
}

console.log("\nTimings on this machine (ms, median of 5 / first run):");
for (const [name, c] of places) {
  const row: string[] = [];
  for (const n of [1000, 10000, 60000]) {
    const r = ms(() => nearestSystems(SEED, c, n));
    row.push(`nearest ${n}: ${r.median.toFixed(1)} / ${r.cold.toFixed(1)}`);
  }
  const w = ms(() => systemsWithin(SEED, c, 80));
  const count = systemsWithin(SEED, c, 80).length;
  row.push(`within 80 ly: ${w.median.toFixed(1)} / ${w.cold.toFixed(1)} (${count} systems)`);
  console.log(`${name.padEnd(20)} ${row.join(" | ")}`);
}
{
  const t = performance.now();
  const all = systemsWithin(SEED, START_POINT, 150);
  const dt = performance.now() - t;
  console.log(`Per system cost (start region, radius 150): ${all.length} systems in ${dt.toFixed(1)} ms = ${((dt / all.length) * 1000).toFixed(2)} microseconds each`);
}

console.log("\nSpacing by radius (ly): formula mid-plane s(r) | density-based spacing in arm centre | mean nearest-neighbour distance measured | expected for random (0.554 x spacing)");
for (const r of [0, 1000, 5000, 16667, 30000, 49500]) {
  const p = { x: r, y: 0, z: 0 };
  // find the arm centre and the gap at this radius by scanning the angle
  let best = 0;
  let bestA = 0;
  let worst = Infinity;
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * 2 * Math.PI;
    const d = densityAt({ x: Math.max(r, 0.001) * Math.cos(a), y: 0, z: Math.max(r, 0.001) * Math.sin(a) });
    if (d > best) {
      best = d;
      bestA = a;
    }
    if (d < worst) worst = d;
  }
  const armPoint = { x: r * Math.cos(bestA), y: 0, z: r * Math.sin(bestA) };
  const sample = nearestSystems(SEED, r === 0 ? p : armPoint, 400);
  let nnSum = 0;
  let nnN = 0;
  for (let i = 0; i < Math.min(200, sample.length); i++) {
    let best2 = Infinity;
    for (let j = 0; j < sample.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(sample[i]!.x - sample[j]!.x, sample[i]!.y - sample[j]!.y, sample[i]!.z - sample[j]!.z);
      if (d < best2) best2 = d;
    }
    nnSum += best2;
    nnN++;
  }
  const armSpacing = Math.cbrt(1 / best);
  console.log(`r=${String(r).padStart(6)}  s=${spacingAt(r).toFixed(2).padStart(7)}  arm centre ${armSpacing.toFixed(2).padStart(7)}  between arms ${Math.cbrt(1 / worst).toFixed(2).padStart(7)}  measured NN ${(nnSum / nnN).toFixed(2).padStart(7)}  (random: ${(0.554 * armSpacing).toFixed(2)})`);
}

console.log("\nStart region:");
{
  const near = nearestSystems(SEED, START_POINT, 10000);
  const first = near[0]!;
  const nm = systemName(SEED, first.id);
  console.log(`Start point (${START_POINT.x.toFixed(1)}, 0, ${START_POINT.z.toFixed(1)}), ${Math.hypot(START_POINT.x, START_POINT.z).toFixed(1)} ly from the centre; nearest system id ${first.id}, name ${nm.name}`);
  console.log(`Systems within 25 ly: ${near.filter((s) => s.distance <= 25).length}, 75 ly: ${near.filter((s) => s.distance <= 75).length}; nearest 10,000 reach ${near[near.length - 1]!.distance.toFixed(1)} ly`);
  const pure = near.slice(0, 5000).filter((s) => systemName(SEED, s.id).isPure).length;
  console.log(`Pure names: ${pureNameCount(SEED)} names have an owner; ${pure} of the nearest 5,000 systems carry one (${((pure / 5000) * 100).toFixed(1)} %)`);
}

console.log("\nCodes: length by position (symbols) and by the whole galaxy:");
{
  for (const r of [0, 1000, 5000, 16667, 30000, 49500]) {
    const s = nearestSystems(SEED, { x: r, y: 0, z: 0 }, 1)[0]!;
    console.log(`  r=${r}: id ${s.id} code ${encodeSystemNumber(s.id)} (${encodeSystemNumber(s.id).length - 1} symbols)`);
  }
  const rnd = lcg(5);
  const lengths = new Map<number, number>();
  let counted = 0;
  for (let i = 0; i < 300000; i++) {
    const cell = Math.floor(rnd() * table.totalCells);
    for (const s of systemsOfCell(SEED, cell)) {
      const l = encodeSystemNumber(s.id).length - 1;
      lengths.set(l, (lengths.get(l) ?? 0) + 1);
      counted++;
    }
  }
  console.log("  share of all systems by code length: " + [...lengths].sort((a, b) => a[0] - b[0]).map(([l, n]) => `${l}: ${((n / counted) * 100).toFixed(1)} %`).join(", "));
}

console.log("\nUniqueness over a big sample:");
{
  const rnd = lcg(123);
  const ids = new Set<number>();
  const codes = new Set<string>();
  const names = new Set<string>();
  let n = 0;
  let bad = 0;
  const t = performance.now();
  for (let i = 0; i < 3300000; i++) {
    for (const s of systemsOfCell(SEED, Math.floor(rnd() * table.totalCells))) {
      n++;
      ids.add(s.id);
      const code = encodeSystemNumber(s.id);
      codes.add(code);
      if (decodeSystemNumber(code) !== s.id) bad++;
    }
  }
  console.log(`  ${n} systems from random cells: ${ids.size} different ids, ${codes.size} different codes, ${bad} codes that do not decode back (${((performance.now() - t) / 1000).toFixed(1)} s)`);
  const near = nearestSystems(SEED, START_POINT, 60000);
  let dupNames = 0;
  for (const s of near) {
    const full = systemName(SEED, s.id).name.toLowerCase();
    if (names.has(full)) dupNames++;
    names.add(full);
  }
  console.log(`  60,000 nearest systems at the start: ${dupNames} repeated full names`);
}

console.log("\nOdd systems (placed very close to a neighbour): share with a neighbour closer than 0.2 x local spacing, start region:");
{
  const near = nearestSystems(SEED, START_POINT, 3000);
  let close = 0;
  let minD = Infinity;
  const sample = near.slice(0, 1500);
  for (const s of sample) {
    let nn = Infinity;
    for (const o of near) {
      if (o.id === s.id) continue;
      const d = Math.hypot(s.x - o.x, s.y - o.y, s.z - o.z);
      if (d < nn) nn = d;
    }
    if (nn < 0.2 * 6.7) close++;
    minD = Math.min(minD, nn);
  }
  console.log(`  ${close} of ${sample.length} (${((close / sample.length) * 100).toFixed(1)} %); closest pair ${minD.toFixed(3)} ly`);
}

console.log("\nSky (lineIntegralDensity) cost:");
{
  const origin = START_POINT;
  const faces = 6 * 32 * 32;
  const steps = 128;
  const t = performance.now();
  let sum = 0;
  for (let f = 0; f < faces; f++) {
    const a = (f / faces) * 2 * Math.PI;
    sum += lineIntegralDensity(origin, { x: Math.cos(a), y: Math.sin(f) * 0.3, z: Math.sin(a) }, 30000, steps);
  }
  const dt = performance.now() - t;
  console.log(`  ${faces} rays x ${steps} steps (a 6 x 32 x 32 sky cube) = ${dt.toFixed(0)} ms (sum ${sum.toFixed(0)}); per ray ${((dt / faces) * 1000).toFixed(0)} microseconds`);
}
console.log(`\nDone. Disc radius ${DISC_RADIUS}.`);
