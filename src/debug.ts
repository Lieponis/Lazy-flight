// The debug page (debug.html). Shows the universe generator as plain text and tables.
// It only READS from the universe module. It does not touch the cube page.

import {
  MAX_JOB_DISTANCE,
  getDock,
  getMarket,
  getPlanetsOfSystem,
  getSystem,
  distance,
  generateJobBoard,
  listSystemsNear,
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
      return `<tr>
        <td><button class="pick" data-system="${esc(s.id)}">${esc(s.name)}</button></td>
        <td>${esc(s.id)}</td>
        <td><span class="swatch" style="background:${esc(s.star.color)}"></span>${esc(s.star.label)}</td>
        <td>${s.planetCount}</td>
        <td>${d}</td>
      </tr>`;
    })
    .join("");
  return `<p>${systems.length} systems within ${radius} light years of (${center.x}, ${center.y}, ${center.z}), nearest first.</p>
    <table><tr><th>Name</th><th>Id</th><th>Star</th><th>Planets</th><th>Distance (ly)</th></tr>${rows}</table>`;
}

function renderSystem(): string {
  const seed = seedBox.value;
  const system = getSystem(seed, systemIdBox.value.trim());
  if (!system) return `<p class="dear">No system with id "${esc(systemIdBox.value)}". Click a system name in the table above.</p>`;
  const planets = getPlanetsOfSystem(seed, system.id);
  const rows = planets
    .map((p) => {
      const dock = getDock(seed, p.id);
      return `<tr>
        <td><button class="pick" data-planet="${p.index}">${p.index}</button></td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.type)}</td>
        <td>${p.radius}</td>
        <td>
          <span class="swatch" style="background:${esc(p.colors.primary)}"></span>
          <span class="swatch" style="background:${esc(p.colors.secondary)}"></span>
          <span class="swatch" style="background:${esc(p.colors.accent)}"></span>
        </td>
        <td>${dock ? esc(dock.name) : "?"}</td>
        <td>${dock ? esc(dock.kind) : "?"}</td>
      </tr>`;
    })
    .join("");
  return `<p><b>${esc(system.name)}</b> (id ${esc(system.id)}), ${esc(system.star.label)}
      <span class="swatch" style="background:${esc(system.star.color)}"></span>, ${system.planetCount} planet(s),
      position (${system.position.x.toFixed(1)}, ${system.position.y.toFixed(1)}, ${system.position.z.toFixed(1)}).</p>
    <table><tr><th>#</th><th>Planet</th><th>Type</th><th>Radius (Earth = 1)</th><th>Colors</th><th>Dock</th><th>Dock type</th></tr>${rows}</table>`;
}

function currentDockId(): string {
  return `${systemIdBox.value.trim()}/${Math.max(0, Math.floor(num(planetIndexBox, 0)))}`;
}

function renderDock(): string {
  const seed = seedBox.value;
  const slot = Math.floor(num(slotBox, 0));
  const dock = getDock(seed, currentDockId());
  if (!dock) return `<p class="dear">No dock for "${esc(currentDockId())}". Pick a system and a planet number first.</p>`;
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
  return `<p><b>${esc(dock.name)}</b> (${esc(dock.kind)}, id ${esc(dock.id)}). Passenger terminal: ${dock.hasPassengerTerminal ? "yes" : "no"}.<br />${esc(perks)}<br />
    Prices at time slot ${slot}:</p>
    <table><tr><th>Good</th><th>Category</th><th>Base price</th><th>Price now</th><th>Note</th></tr>${rows}</table>`;
}

function renderJobs(): string {
  const seed = seedBox.value;
  const slot = Math.floor(num(slotBox, 0));
  const dock = getDock(seed, currentDockId());
  if (!dock) return `<p class="dear">No dock selected.</p>`;
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

function renderAll(): void {
  // If no system is chosen yet, take the nearest one.
  if (systemIdBox.value.trim() === "") {
    const first = listSystemsNear(seedBox.value, { x: num(cx, 0), y: num(cy, 0), z: num(cz, 0) }, 60)[0];
    if (first) systemIdBox.value = first.id;
  }
  el("nearby").innerHTML = renderNearby();
  el("system").innerHTML = renderSystem();
  el("dock").innerHTML = renderDock();
  el("jobs").innerHTML = renderJobs();
  writeUrl();
}

// "Show": new seed or new coordinates. Forget the chosen system so the nearest one is used.
el("show").addEventListener("click", () => {
  systemIdBox.value = "";
  planetIndexBox.value = "0";
  renderAll();
});
el("showSystem").addEventListener("click", renderAll);
slotBox.addEventListener("change", renderAll);

// Clicking a system name or planet number.
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const system = target.dataset["system"];
  const planet = target.dataset["planet"];
  if (system !== undefined) {
    systemIdBox.value = system;
    planetIndexBox.value = "0";
    renderAll();
  } else if (planet !== undefined) {
    planetIndexBox.value = planet;
    renderAll();
  }
});

readUrl();
renderAll();
