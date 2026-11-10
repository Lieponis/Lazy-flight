// Prints the balance report as tables. Run: npm run balance   (optional: npm run balance -- 60  = hours per run)
import { STRATEGIES, simulate, type RunResult } from "./balance-sim";

const SEEDS = [12345, 777, 999, 4242, 31337, 1, 2024, 555];
const HOURS = Number(process.argv[2] ?? 40);
const TRIP_SCALE = Number(process.argv[3] ?? 1); // what-if: 0.25 = trips 4x shorter

const fmt = (v: number | null, digits = 1): string => (v === null ? "never" : v.toFixed(digits));
const median = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length < xs.length / 2) return null; // most runs never got there
  return v[Math.floor(v.length / 2)] ?? null;
};
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

const started = Date.now();
const all: RunResult[] = [];
for (const s of STRATEGIES) for (const seed of SEEDS) all.push(simulate(seed, s, HOURS, TRIP_SCALE));

console.log(`\n# Balance simulation: ${SEEDS.length} seeds x ${STRATEGIES.length} strategies, ${HOURS} game hours each, speed 1${TRIP_SCALE !== 1 ? `, WHAT-IF trips x${TRIP_SCALE}` : ""}\n`);
for (const s of STRATEGIES) console.log(`- **${s.name}**: ${s.about}`);

console.log(`\n## Money and pace (medians over seeds; hours = real hours at speed 1)\n`);
console.log("| strategy | cr/hour | jobs/hour | avg trip min | avg reward | to 1200 cr | to 1500 cr (h / jobs) | first ship (h) | first outpost (h / jobs) | outpost price |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const s of STRATEGIES) {
  const rs = all.filter((r) => r.strategy === s.name);
  console.log(
    `| ${s.name} | ${fmt(median(rs.map((r) => r.creditsPerHour)), 0)} | ${fmt(median(rs.map((r) => r.jobsDone / HOURS)), 2)} | ${fmt(median(rs.map((r) => r.avgTripMin)), 0)} | ${fmt(median(rs.map((r) => r.avgReward)), 0)} | ${fmt(median(rs.map((r) => r.hoursTo1200)))} | ${fmt(median(rs.map((r) => r.hoursTo1500)))} / ${fmt(median(rs.map((r) => r.jobsTo1500)), 0)} | ${fmt(median(rs.map((r) => r.hoursToFirstShip)))} | ${fmt(median(rs.map((r) => r.hoursToOutpost)))} / ${fmt(median(rs.map((r) => r.jobsToOutpost)), 0)} | ${fmt(median(rs.map((r) => r.outpostPrice)), 0)} |`,
  );
}

console.log(`\n## Ranks: hours to rank 2 / rank 3 (median; "never" = most runs did not reach it in ${HOURS} h)\n`);
console.log("| strategy | cargo r2 | cargo r3 | passengers r2 | passengers r3 | tours r2 | tours r3 | jobs taken C/P/T |");
console.log("|---|---|---|---|---|---|---|---|");
for (const s of STRATEGIES) {
  const rs = all.filter((r) => r.strategy === s.name);
  const cell = (k: string, i: 0 | 1): string => fmt(median(rs.map((r) => r.rankHours[k]![i])));
  const kinds = ["TRADE", "PASSENGER", "TOUR"].map((k) => avg(rs.map((r) => r.kinds[k] ?? 0)).toFixed(0)).join("/");
  console.log(`| ${s.name} | ${cell("TRADE", 0)} | ${cell("TRADE", 1)} | ${cell("PASSENGER", 0)} | ${cell("PASSENGER", 1)} | ${cell("TOUR", 0)} | ${cell("TOUR", 1)} | ${kinds} |`);
}

console.log(`\n## Blocked jobs (share of all board entries seen with the active ship) and dead ends\n`);
const codes = ["ok", "not-enough-fuel", "cargo-too-large", "no-cabin", "cabin-too-small", "tank-too-small", "rank-too-low"];
console.log(`| strategy | ${codes.join(" | ")} | waits/10h | wait h/10h | stuck | emergency fuel | repeat jobs | accept refused |`);
console.log(`|---|${codes.map(() => "---").join("|")}|---|---|---|---|---|---|`);
for (const s of STRATEGIES) {
  const rs = all.filter((r) => r.strategy === s.name);
  const total = rs.reduce((a, r) => a + Object.values(r.blocks).reduce((x, y) => x + y, 0), 0);
  const pct = (c: string): string => ((100 * rs.reduce((a, r) => a + (r.blocks[c] ?? 0), 0)) / Math.max(1, total)).toFixed(0) + "%";
  const per10 = (f: (r: RunResult) => number): string => ((10 * rs.reduce((a, r) => a + f(r), 0)) / (rs.length * HOURS)).toFixed(2);
  const sum = (f: (r: RunResult) => number): number => rs.reduce((a, r) => a + f(r), 0);
  console.log(`| ${s.name} | ${codes.map(pct).join(" | ")} | ${per10((r) => r.waits)} | ${per10((r) => r.waitHours)} | ${sum((r) => r.stuck)} | ${sum((r) => r.emergencyRefuels)} | ${sum((r) => r.repeatJobs)} | ${sum((r) => r.acceptRefused)} |`);
}

const tours = all.reduce((a, r) => a + r.toursSeen, 0);
const tooFar = all.reduce((a, r) => a + r.toursTooFarForLiner, 0);
console.log(`\nTours seen: ${tours}; too far for the Liner tank: ${tooFar} (${((100 * tooFar) / Math.max(1, tours)).toFixed(0)}%).`);

const visits = all.filter((r) => r.strategy === "sensible");
const prices = visits.flatMap((r) => r.outpostPricesSeen).sort((a, b) => a - b);
const decisions = visits.reduce((a, r) => a + r.boardsSeen, 0);
console.log(`\nOutposts (sensible): docked at a surface outpost in ${visits.reduce((a, r) => a + r.outpostVisits, 0)} of ${decisions} stops; prices seen min ${prices[0] ?? "-"}, median ${prices[Math.floor(prices.length / 2)] ?? "-"}, max ${prices[prices.length - 1] ?? "-"}.`);

// ------------------------------------------------------------ upgrades (6c)
const UP_HOURS = Number(process.argv[4] ?? 100);
console.log(`\n## Upgrades (${UP_HOURS} game hours per run, medians; "never" = most runs did not get there)\n`);
console.log("| strategy | 1st upgrade (h) | 1st tank | 1st hold | 1st engines | 1st comfort | a full track (h) | all tracks, one ship (h) | levels bought | spent on upgrades | credits at end |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
const up: RunResult[] = [];
const noUp: RunResult[] = [];
for (const s of STRATEGIES)
  for (const seed of SEEDS) {
    up.push(simulate(seed, s, UP_HOURS, TRIP_SCALE, true));
    noUp.push(simulate(seed, s, UP_HOURS, TRIP_SCALE, false));
  }
for (const s of STRATEGIES) {
  const rs = up.filter((r) => r.strategy === s.name);
  const f = (k: "tank" | "hold" | "engines" | "comfort"): string => fmt(median(rs.map((r) => r.firstLevelHours[k])));
  console.log(
    `| ${s.name} | ${fmt(median(rs.map((r) => r.hoursToFirstUpgrade)))} | ${f("tank")} | ${f("hold")} | ${f("engines")} | ${f("comfort")} | ${fmt(median(rs.map((r) => r.hoursToFullTrack)))} | ${fmt(median(rs.map((r) => r.hoursToAllTracksOneShip)))} | ${fmt(median(rs.map((r) => r.upgradeLevelsBought)), 0)} | ${fmt(median(rs.map((r) => r.spentOnUpgrades)), 0)} | ${fmt(median(rs.map((r) => r.creditsEnd)), 0)} |`,
  );
}
console.log(`\n### With vs without upgrades (same players, ${UP_HOURS} h)\n`);
console.log("| strategy | cr/hour without | cr/hour with | fuel spent without | fuel spent with | tour lines too far without | with | credits at end without | with |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const s of STRATEGIES) {
  const a = noUp.filter((r) => r.strategy === s.name);
  const b = up.filter((r) => r.strategy === s.name);
  const share = (rs: RunResult[]): string => {
    const seen = rs.reduce((x, r) => x + r.tourLinesSeen, 0);
    return seen ? `${((100 * rs.reduce((x, r) => x + r.tourLinesTooFar, 0)) / seen).toFixed(0)}% of ${seen}` : "-";
  };
  const m = (rs: RunResult[], f: (r: RunResult) => number, d = 0): string => fmt(median(rs.map(f)), d);
  console.log(`| ${s.name} | ${m(a, (r) => r.creditsPerHour)} | ${m(b, (r) => r.creditsPerHour)} | ${m(a, (r) => r.spentOnFuel)} | ${m(b, (r) => r.spentOnFuel)} | ${share(a)} | ${share(b)} | ${m(a, (r) => r.creditsEnd)} | ${m(b, (r) => r.creditsEnd)} |`);
}

console.log(`\n## Per seed (sensible)\n`);
console.log("| seed | cr/hour | to 1500 | first ship | outpost (h) | price | credits at end | waits |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of all.filter((x) => x.strategy === "sensible")) {
  console.log(`| ${r.seed} | ${r.creditsPerHour.toFixed(0)} | ${fmt(r.hoursTo1500)} | ${r.firstShip ?? "-"} @ ${fmt(r.hoursToFirstShip)} | ${fmt(r.hoursToOutpost)} | ${fmt(r.outpostPrice, 0)} | ${r.creditsEnd} | ${r.waits} |`);
}
console.log(`\n(simulated in ${((Date.now() - started) / 1000).toFixed(1)} s)`);
