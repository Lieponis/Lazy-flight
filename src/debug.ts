// The debug page (debug.html). Shows the universe generator as plain text and tables.
// It only READS from the universe module. It does not touch the cube page.

import {
  MAX_DOCKS_PER_SYSTEM,
  MAX_JOB_DISTANCE,
  MAX_PLANETS,
  UNIVERSE_VERSION,
  distance,
  docksOf,
  findSystemByName,
  nameStats,
  generateJobBoard,
  getDock,
  getMarket,
  getPlanetsOfSystem,
  getSystem,
  listSystemsNear,
  maxDocksFor,
  summarizeSurveys,
  surveySeed,
  type SeedSurvey,
} from "./universe";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`debug.html is missing the element #${id}`);
  return found as T;
}

function esc(text: string | number): string {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const seedBox = el<HTMLInputElement>("seed");
const slotBox = el<HTMLInputElement>("slot");
const cx = el<HTMLInputElement>("cx");
const cy = el<HTMLInputElement>("cy");
const cz = el<HTMLInputElement>("cz");
const radiusBox = el<HTMLInputElement>("radius");
const systemIdBox = el<HTMLInputElement>("systemId");
const planetIndexBox = el<HTMLInputElement>("planetIndex");

function num(input: HTMLInputElement, fallback: number): number {
  const n = Number(input.value);
  return Number.isFinite(n) ? n : fallback;
}

function readUrl(): void {
  const params = new URLSearchParams(location.search);
  const set = (key: string, input: HTMLInputElement) => {
    const v = params.get(key);
    if (v !== null) input.value = v;
  };
  set("seed", seedBox);
  set("slot", slotBox);
  set("x", cx);
  set("y", cy);
  set("z", cz);
  set("r", radiusBox);
  set("sys", systemIdBox);
  set("planet", planetIndexBox);
}

function writeUrl(): void {
  const params = new URLSearchParams({
    seed: seedBox.value,
    slot: slotBox.value,
    x: cx.value,
    y: cy.value,
    z: cz.value,
    r: radiusBox.value,
    sys: systemIdBox.value,
    planet: planetIndexBox.value,
  });
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function renderNearby(): string {
  const seed = seedBox.value;
  const center = { x: num(cx, 0), y: num(cy, 0), z: num(cz, 0) };
  const radius = Math.min(60, Math.max(1, num(radiusBox, 25)));
  const systems = listSystemsNear(seed, center, radius);
  const rows = systems
    .map((s) => {
      const d = distance(s.position, center).toFixed(1);
      const dockCount = docksOf(seed, s).length;
      return `<tr>
        <td><button class="pick" data-system="${esc(s.id)}">${esc(s.name)}</button></td>
        <td>${esc(s.code)}</td>
        <td>${s.isPure ? "pure name" : "word + code"}</td>
        <td>${esc(s.id)}</td>
        <td><span class="swatch" style="background:${esc(s.star.color)}"></span>${esc(s.star.label)}</td>
        <td>${s.planetCount}</td>
        <td>${dockCount} <span class="note">(at most ${maxDocksFor(s.planetCount)})</span></td>
        <td>${d}</td>
      </tr>`;
    })
    .join("");
  return `<p>${systems.length} systems within ${radius} light years of (${center.x}, ${center.y}, ${center.z}), nearest first.</p>
    <table><tr><th>Name</th><th>Code</th><th>Name kind</th><th>Id</th><th>Star</th><th>Planets</th><th>Docks</th><th>Distance (ly)</th></tr>${rows}</table>`;
}

function renderSystem(): string {
  const seed = seedBox.value;
  const system = getSystem(seed, systemIdBox.value.trim());
  if (!system) return `<p class="dear">No system with id "${esc(systemIdBox.value)}". Click a system name in the table above.</p>`;
  const planets = getPlanetsOfSystem(seed, system.id);
  const docks = docksOf(seed, system);
  const rows = planets
    .map((p) => {
      const dock = getDock(seed, p.id);
      const dockCells = dock
        ? `<td><b>${esc(dock.fullName)}</b></td><td><b>${esc(dock.kind)}</b></td>`
        : `<td class="note">no dock</td><td class="note">-</td>`;
      return `<tr class="${dock ? "has-dock" : "no-dock"}">
        <td><button class="pick" data-planet="${p.index}">${p.index}</button></td>
        <td>${esc(p.name)}${p.nickname ? ` <span class="note">(nickname: ${esc(p.nickname)})</span>` : ""}</td>
        <td>${esc(p.type)}</td>
        <td>${p.radius}</td>
        <td>
          <span class="swatch" style="background:${esc(p.colors.primary)}"></span>
          <span class="swatch" style="background:${esc(p.colors.secondary)}"></span>
          <span class="swatch" style="background:${esc(p.colors.accent)}"></span>
        </td>
        ${dockCells}
      </tr>`;
    })
    .join("");
  return `<p><b>${esc(system.name)}</b> (${system.isPure ? "pure name" : "word + code"}, code ${esc(system.code)}, id ${esc(system.id)}), ${esc(system.star.label)}
      <span class="swatch" style="background:${esc(system.star.color)}"></span>,
      position (${system.position.x.toFixed(1)}, ${system.position.y.toFixed(1)}, ${system.position.z.toFixed(1)}).<br />
      <b>${system.planetCount} planets, ${docks.length} dock(s)</b> (a system with ${system.planetCount} planets can have 1 to ${maxDocksFor(system.planetCount)}).
      Planets with a dock are in bold; the others are scenery with no dock.</p>
    <table><tr><th>#</th><th>Planet</th><th>Type</th><th>Radius (Earth = 1)</th><th>Colors</th><th>Dock</th><th>Dock type</th></tr>${rows}</table>`;
}

function currentDockId(): string {
  return `${systemIdBox.value.trim()}/${Math.max(0, Math.floor(num(planetIndexBox, 0)))}`;
}

function noDockMessage(): string {
  const seed = seedBox.value;
  const system = getSystem(seed, systemIdBox.value.trim());
  if (!system) return `<p class="dear">Pick a system first (click a blue system name above).</p>`;
  const list = docksOf(seed, system)
    .map((d) => `planet ${d.planetId.split("/")[1]} (${esc(d.name)})`)
    .join(", ");
  return `<p class="dear">Planet ${esc(planetIndexBox.value)} has no dock. Docks in this system: ${list}. Click one of those planet numbers in table 2.</p>`;
}

function renderDock(): string {
  const seed = seedBox.value;
  const slot = Math.floor(num(slotBox, 0));
  const dock = getDock(seed, currentDockId());
  if (!dock) return noDockMessage();
  const perks = dock.perks
    ? `Outpost for sale: ${dock.outpostPrice} credits. Perks: ${Math.round(dock.perks.fuelDiscount * 100)}% cheaper fuel, ${dock.perks.passiveIncomePerHour} credits per hour.`
    : "Station: not for sale.";
  const market = getMarket(seed, dock, slot);
  const rows = market
    .map((m) => {
      const cls = m.role === "PRODUCES" ? "cheap" : m.role === "WANTS" ? "dear" : "";
      const label = m.role === "PRODUCES" ? "makes it (cheap)" : m.role === "WANTS" ? "wants it (pays well)" : "";
      return `<tr><td>${esc(m.good.name)}</td><td>${esc(m.good.category)}</td><td>${m.good.basePrice}</td><td class="${cls}">${m.price}</td><td class="${cls}">${label}</td></tr>`;
    })
    .join("");
  return `<p><b>${esc(dock.fullName)}</b> (short name "${esc(dock.name)}", ${esc(dock.kind)}, id ${esc(dock.id)}). Passenger terminal: ${dock.hasPassengerTerminal ? "yes" : "no"}.<br />${esc(perks)}<br />
    Prices at time slot ${slot}:</p>
    <table><tr><th>Good</th><th>Category</th><th>Base price</th><th>Price now</th><th>Note</th></tr>${rows}</table>`;
}

function renderJobs(): string {
  const seed = seedBox.value;
  const slot = Math.floor(num(slotBox, 0));
  const dock = getDock(seed, currentDockId());
  if (!dock) return noDockMessage();
  const board = generateJobBoard(seed, dock, slot);
  if (board.length === 0) return `<p class="dear">This dock has no jobs right now.</p>`;
  const nameOf = (id: string): string => {
    const d = getDock(seed, id);
    return d ? d.name : id;
  };
  const rows = board
    .map((j) => {
      const route = j.stops.map((s) => esc(nameOf(s))).join(" &rarr; ");
      const limit = j.timeLimitSlots === null ? "none" : `${j.timeLimitSlots} h`;
      return `<tr>
        <td>${esc(j.kind)}</td>
        <td>${j.amount} &times; ${esc(j.itemName)}</td>
        <td>${esc(j.requiredHold)}</td>
        <td>${route}</td>
        <td>${j.totalDistance}</td>
        <td>${limit}</td>
        <td><b>${j.reward}</b></td>
        <td>${esc(j.blurb)}</td>
      </tr>`;
    })
    .join("");
  return `<p>Job board of <b>${esc(dock.name)}</b> at time slot ${slot}. Destinations are never farther than ${MAX_JOB_DISTANCE} light years.</p>
    <table><tr><th>Kind</th><th>Load</th><th>Hold</th><th>Route</th><th>Distance (ly)</th><th>Time limit</th><th>Reward</th><th>Blurb</th></tr>${rows}</table>`;
}

/** The planet number of the first dock of a system, as text. */
function firstDockNumber(systemId: string): string {
  const system = getSystem(seedBox.value, systemId);
  const first = system ? docksOf(seedBox.value, system)[0] : undefined;
  return first ? first.planetId.split("/")[1] ?? "0" : "0";
}

const surveyFirst = el<HTMLInputElement>("surveyFirst");
const surveyCount = el<HTMLInputElement>("surveyCount");
const surveyOut = el("survey");
let surveyRun = 0;

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function distributionText(counts: number[], from: number, to: number): string {
  const total = counts.reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  for (let i = from; i <= to; i++) parts.push(`${i}: ${counts[i] ?? 0} (${pct((counts[i] ?? 0) / Math.max(1, total))})`);
  return parts.join(" | ");
}

function renderSurvey(surveys: SeedSurvey[], finished: boolean): string {
  const sum = summarizeSurveys(surveys);
  const rows = surveys
    .map((s) => {
      const one = summarizeSurveys([s]);
      const docksPerSystem = s.systems === 0 ? 0 : s.docks / s.systems;
      return `<tr>
        <td>${esc(s.seed)}</td><td>${s.systems}</td><td>${s.docks}</td><td>${docksPerSystem.toFixed(2)}</td>
        <td>${pct(one.outpostShare)}</td><td>${one.reachableAvg.toFixed(0)}</td><td>${one.reachableMin}</td>
        <td>${one.jobsAvg.toFixed(1)}</td><td>${one.jobsMin}</td><td>${one.thinBoards}</td><td>${pct(one.boardsWithTourShare)}</td>
      </tr>`;
    })
    .join("");
  return `<p>${finished ? "Done" : "Working"}: ${surveys.length} seed(s). Universe version ${UNIVERSE_VERSION}.
    Systems within 35 light years of the look-around point; job boards for docks within 15 light years of it, at time slot 0.</p>
    <table>
      <tr><th>All seeds together</th><th>Value</th></tr>
      <tr><td>Systems counted</td><td>${sum.systems}</td></tr>
      <tr><td>Systems by planet count</td><td>${distributionText(sum.planetsPerSystem, 1, MAX_PLANETS)}</td></tr>
      <tr><td>Systems by dock count</td><td>${distributionText(sum.docksPerSystem, 0, MAX_DOCKS_PER_SYSTEM)}</td></tr>
      <tr><td>Docks: outposts / stations</td><td>${pct(sum.outpostShare)} / ${pct(sum.stationShare)} (with passenger terminal: ${pct(sum.terminalShare)})</td></tr>
      <tr><td>Other docks within ${MAX_JOB_DISTANCE} ly of a dock (average / smallest)</td><td>${sum.reachableAvg.toFixed(1)} / ${sum.reachableMin}</td></tr>
      <tr><td>Jobs per board (average / smallest)</td><td>${sum.jobsAvg.toFixed(2)} / ${sum.jobsMin}</td></tr>
      <tr><td>Boards with fewer than 3 jobs / with none (of ${sum.boards})</td><td>${sum.thinBoards} / ${sum.emptyBoards}</td></tr>
      <tr><td>Tours: share of jobs / share of boards with at least one</td><td>${pct(sum.tourJobShare)} / ${pct(sum.boardsWithTourShare)}</td></tr>
    </table>
    <table>
      <tr><th>Seed</th><th>Systems</th><th>Docks</th><th>Docks per system</th><th>Outposts</th><th>Reachable docks (avg)</th><th>(min)</th><th>Jobs per board (avg)</th><th>(min)</th><th>Boards under 3</th><th>Boards with a tour</th></tr>
      ${rows}
    </table>`;
}

function runSurvey(): void {
  const run = ++surveyRun;
  const first = Math.floor(num(surveyFirst, 1));
  const count = Math.min(200, Math.max(1, Math.floor(num(surveyCount, 50))));
  const center = { x: num(cx, 0), y: num(cy, 0), z: num(cz, 0) };
  const surveys: SeedSurvey[] = [];
  surveyOut.innerHTML = "<p>Working...</p>";
  const next = (): void => {
    if (run !== surveyRun) return; // a newer run started
    if (surveys.length >= count) {
      surveyOut.innerHTML = renderSurvey(surveys, true);
      return;
    }
    surveys.push(surveySeed(first + surveys.length, { center }));
    if (surveys.length % 5 === 0) surveyOut.innerHTML = renderSurvey(surveys, false);
    setTimeout(next, 0);
  };
  setTimeout(next, 0);
}
el("runSurvey").addEventListener("click", runSurvey);

// Names: search and statistics.
function renderNameSearch(): string {
  const text = (el("nameSearch") as HTMLInputElement).value;
  if (text.trim() === "") return `<p class="note">Type a code like 4F-92 or a name like "Lazy Harbour" and press Find.</p>`;
  const found = findSystemByName(seedBox.value, text);
  if (!found) return `<p class="dear">No system found for "${esc(text)}".</p>`;
  return `<p>Found <b><button class="pick" data-system="${esc(found.id)}">${esc(found.name)}</button></b> (code ${esc(found.code)}, ${found.isPure ? "pure name" : "word + code"}, id ${esc(found.id)}). Click the name to open it above.</p>`;
}

function renderNameStats(): string {
  const seed = seedBox.value;
  const center = { x: num(cx, 0), y: num(cy, 0), z: num(cz, 0) };
  const radius = Math.min(60, Math.max(1, num(radiusBox, 25)));
  const n = nameStats(seed, center, radius);
  const share = n.systems === 0 ? 0 : (100 * n.pureSystems) / n.systems;
  return `<table>
    <tr><th>Systems in the sample</th><td>${n.systems} (planets ${n.planets}, docks ${n.docks})</td></tr>
    <tr><th>Share of pure names</th><td>${share.toFixed(1)} % (${n.pureSystems} systems)</td></tr>
    <tr><th>Longest system name</th><td>${esc(n.longestSystem)} (${n.longestSystem.length} letters)</td></tr>
    <tr><th>Longest planet name</th><td>${esc(n.longestPlanet)} (${n.longestPlanet.length} letters)</td></tr>
    <tr><th>Longest dock full name</th><td>${esc(n.longestDock)} (${n.longestDock.length} letters)</td></tr>
    <tr><th>Collisions found (must be 0)</th><td class="${n.collisions === 0 ? "cheap" : "dear"}">${n.collisions}</td></tr>
  </table>`;
}

function renderAll(): void {
  // If no system is chosen yet, take the nearest one, and its first dock.
  if (systemIdBox.value.trim() === "") {
    const first = listSystemsNear(seedBox.value, { x: num(cx, 0), y: num(cy, 0), z: num(cz, 0) }, 60)[0];
    if (first) {
      systemIdBox.value = first.id;
      planetIndexBox.value = firstDockNumber(first.id);
    }
  }
  el("nearby").innerHTML = renderNearby();
  el("system").innerHTML = renderSystem();
  el("dock").innerHTML = renderDock();
  el("jobs").innerHTML = renderJobs();
  el("nameSearchOut").innerHTML = renderNameSearch();
  el("nameStats").innerHTML = renderNameStats();
  writeUrl();
}

// "Show": new seed or new coordinates. Forget the chosen system so the nearest one is used.
el("show").addEventListener("click", () => {
  systemIdBox.value = "";
  planetIndexBox.value = "0";
  renderAll();
});
el("showSystem").addEventListener("click", renderAll);
el("nameFind").addEventListener("click", renderAll);
slotBox.addEventListener("change", renderAll);

// Clicking a system name or planet number.
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const system = target.dataset["system"];
  const planet = target.dataset["planet"];
  if (system !== undefined) {
    systemIdBox.value = system;
    planetIndexBox.value = firstDockNumber(system);
    renderAll();
  } else if (planet !== undefined) {
    planetIndexBox.value = planet;
    renderAll();
  }
});

readUrl();
renderAll();
