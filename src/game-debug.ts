// The /game-debug.html test page: plain text and buttons. It makes its OWN Game (never the live one).
// No Three.js, no menus. Buttons marked TEST break the normal rules so Andy can try everything quickly.

import {
  Game,
  checkJob,
  createClock,
  formatDuration,
  getShip,
  parseSpeedParam,
  type BoardEntry,
  type GameClock,
} from "./game";
import {
  generateDock,
  generateJobBoard,
  getDock,
  getPlanetsOfSystem,
  getSystem,
  listSystemsNear,
  type Seed,
} from "./universe";

const HOUR_MS = 3_600_000;
const seedMatch = /[?&]seed=(-?\d{1,12})(?:&|$)/.exec(window.location.search);
const seed: Seed = seedMatch && seedMatch[1] !== undefined ? Number(seedMatch[1]) : 12345;
const speed = parseSpeedParam(window.location.search);

// ------------------------------------------------------------ the page's own game and clock

function findStartDockId(): string {
  for (const radius of [10, 20, 40, 80, 160, 320]) {
    const system = listSystemsNear(seed, { x: 0, y: 0, z: 0 }, radius)[0];
    const planet = system ? getPlanetsOfSystem(seed, system.id)[0] : undefined;
    if (planet) return planet.id;
  }
  throw new Error("No start dock found.");
}

let offsetMs = 0; // TEST buttons move game time forward by changing this
const baseClock = createClock(speed);
const clock: GameClock = { speed, now: () => baseClock.now() + offsetMs };
let game = makeGame();
let message = "Welcome. Try the buttons.";

function makeGame(): Game {
  const g = new Game(seed, findStartDockId(), clock);
  g.subscribe(() => render());
  return g;
}

// ------------------------------------------------------------ tiny DOM helpers

type Child = Node | string;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: { class?: string; id?: string } = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.id) node.id = attrs.id;
  for (const k of kids) node.append(k);
  return node;
}

function button(text: string, onClick: () => void, opts: { test?: boolean; disabled?: boolean; title?: string } = {}): HTMLButtonElement {
  const b = h("button", opts.test ? { class: "test" } : {}, text);
  b.type = "button";
  b.disabled = opts.disabled === true;
  if (opts.title) b.title = opts.title;
  b.addEventListener("click", onClick);
  return b;
}

function dockLabel(dockId: string): string {
  const dock = getDock(seed, dockId);
  const system = dock ? getSystem(seed, dock.systemId) : null;
  return dock ? `${dock.name} (${system?.name ?? "?"})` : dockId;
}

function say(text: string): void {
  message = text;
  render();
}

// ------------------------------------------------------------ the dock chooser (TEST teleport)

let dockCacheKey = "";
let dockCache: { id: string; text: string }[] = [];

/** Docks near the start, with how many passenger and tour jobs the active ship could take there with a full tank. */
function dockList(): { id: string; text: string }[] {
  const slot = game.currentSlot();
  const key = `${seed}|${slot}|${game.state.shipId}`;
  if (key === dockCacheKey) return dockCache;
  const list: { id: string; text: string }[] = [];
  const tank = getShip(game.state.shipId).fuelTankSize;
  for (const system of listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 30).slice(0, 25)) {
    for (const planet of getPlanetsOfSystem(seed, system.id)) {
      const dock = generateDock(seed, planet);
      const board = generateJobBoard(seed, dock, slot);
      let passengers = 0;
      let tours = 0;
      for (const job of board) {
        if (job.kind === "TRADE") continue;
        const probe = { ...game.state, currentDockId: dock.id, fuel: tank, currentJob: null, travelStartMs: null, travelEndMs: null };
        if (checkJob(probe, job) !== null) continue; // counts only jobs the active ship could take with a full tank
        if (job.kind === "PASSENGER") passengers++;
        else if (job.kind === "TOUR") tours++;
      }
      list.push({ id: dock.id, text: `${dock.name} (${system.name}) - passenger jobs: ${passengers}, tours: ${tours}` });
    }
  }
  dockCacheKey = key;
  dockCache = list;
  return list;
}

// ------------------------------------------------------------ drawing the page

let countdownEl: HTMLElement | null = null;
let pendingSelect = "";

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;
  const s = game.state;
  const ship = getShip(s.shipId);
  const flying = s.currentJob !== null;
  const stuck = game.isStuck();
  app.replaceChildren();
  countdownEl = null;

  // Status
  const owned = [`${ship.name} (active, fuel ${s.fuel}/${ship.fuelTankSize})`];
  for (const [id, entry] of Object.entries(s.ownedShips)) owned.push(`${getShip(id).name} (fuel ${entry.fuel}/${getShip(id).fuelTankSize})`);
  const status = h("div", { class: "box" });
  status.append(
    h("div", {}, `Credits: ${s.credits}   |   Fuel: ${s.fuel}/${ship.fuelTankSize}   |   Active ship: ${ship.name}`),
    h("div", {}, `Owned ships: ${owned.join("; ")}`),
    h("div", {}, `Dock: ${dockLabel(s.currentDockId)}   |   Game speed: x${speed}   |   Time slot: ${game.currentSlot()}`),
  );
  const stuckLine = h("div", {}, "Stuck? ");
  stuckLine.append(h("span", { class: stuck ? "bad" : "ok" }, stuck ? "YES (no job can be taken, even by spending all credits on fuel)" : "no"));
  status.append(stuckLine);
  if (flying && s.currentJob) {
    const line = h("div", {}, `In flight: ${s.currentJob.kind} ${s.currentJob.amount} x ${s.currentJob.itemName} to ${dockLabel(s.currentJob.destinationDockId)}. Arrives in `);
    countdownEl = h("b");
    line.append(countdownEl);
    status.append(line);
    tick();
  }
  app.append(h("h2", {}, "1. State"), status);

  // Buttons
  app.append(h("h2", {}, "2. Actions"));
  const row = h("div", { class: "box" });
  row.append(
    button("Refuel (normal)", () => {
      const r = game.refuel();
      say(r.ok ? "Refuelled." : r.reason);
    }),
    button("Emergency refuel (works only when stuck)", () => {
      const r = game.emergencyRefuel();
      say(r.ok ? `+${r.units} fuel. ${r.line}` : r.reason);
    }),
    button("TEST: add 5000 credits", () => {
      game.state = { ...game.state, credits: game.state.credits + 5000 };
      say("Added 5000 credits.");
    }, { test: true }),
    button("TEST: set credits to 10", () => {
      game.state = { ...game.state, credits: 10 };
      say("Credits set to 10.");
    }, { test: true }),
    button("TEST: set fuel to 0", () => {
      game.state = { ...game.state, fuel: 0 };
      say("Fuel set to 0.");
    }, { test: true }),
    button("TEST: fast-forward the trip to its end", () => {
      const end = game.state.travelEndMs;
      if (end === null) return say("No trip is running.");
      offsetMs += Math.max(0, end - clock.now()) + 1;
      const arrival = game.update();
      say(arrival ? `Arrived! Paid ${arrival.reward} credits. ${arrival.debrief}` : "Not there yet.");
    }, { test: true, disabled: !flying }),
    button("TEST: next job board (+6 game hours)", () => {
      if (flying) return say("Not during a flight.");
      offsetMs += 6 * HOUR_MS;
      say("Moved 6 game hours ahead. The board may have changed.");
    }, { test: true, disabled: flying }),
    button("TEST: start a new game", () => {
      offsetMs = 0;
      game = makeGame();
      dockCacheKey = "";
      say("New game started.");
    }, { test: true }),
  );
  app.append(row, h("div", { class: "msg" }, message));

  if (game.lastArrival && !flying) {
    app.append(h("div", { class: "debrief" }, `Last delivery: +${game.lastArrival.reward} credits. ${game.lastArrival.debrief}`));
  }

  // Ship catalog
  app.append(h("h2", {}, "3. Ship catalog"));
  const shipTable = h("table");
  shipTable.append(h("tr", {}, ...["Ship", "Price", "Cargo", "Cabin", "Tank", "Owned", "Active", "Can buy", "Reason", ""].map((t) => h("th", {}, t))));
  for (const entry of game.getShipCatalog()) {
    const tr = h("tr");
    const actions = h("td");
    actions.append(
      button("Buy", () => {
        const r = game.buyShip(entry.ship.id);
        say(r.ok ? `Bought the ${entry.ship.name}.` : r.reason);
      }, { disabled: !entry.canBuy }),
      button("Switch", () => {
        const r = game.switchShip(entry.ship.id);
        say(r.ok ? `Now flying the ${entry.ship.name}.` : r.reason);
      }, { disabled: !entry.canSwitch }),
    );
    tr.append(
      h("td", {}, `${entry.ship.name} - ${entry.ship.description}`),
      h("td", {}, String(entry.ship.price)),
      h("td", {}, String(entry.ship.cargoCapacity)),
      h("td", {}, String(entry.ship.cabinCapacity)),
      h("td", {}, String(entry.ship.fuelTankSize)),
      h("td", {}, entry.owned ? `yes (fuel ${entry.fuel ?? "?"})` : "no"),
      h("td", {}, entry.active ? "ACTIVE" : ""),
      h("td", {}, entry.canBuy ? "yes" : "no"),
      h("td", {}, entry.reason),
      actions,
    );
    shipTable.append(tr);
  }
  app.append(h("div", { class: "scroll" }, shipTable));

  // Dock chooser
  app.append(h("h2", {}, "4. Where am I? (TEST teleport)"));
  const chooser = h("div", { class: "box" });
  const select = h("select");
  for (const d of dockList()) {
    const opt = h("option", {}, d.text);
    opt.value = d.id;
    if (d.id === (pendingSelect || s.currentDockId)) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => {
    pendingSelect = select.value;
  });
  chooser.append(
    h("div", { class: "note" }, "Pick a dock with passenger or tour jobs for your active ship, then teleport there. Counts only include jobs the active ship could take with a full tank."),
    select,
    button("TEST: teleport here", () => {
      if (game.state.currentJob) return say("Not during a flight.");
      game.state = { ...game.state, currentDockId: select.value };
      pendingSelect = "";
      say(`Teleported to ${dockLabel(select.value)}.`);
    }, { test: true, disabled: flying }),
  );
  app.append(chooser);

  // Job board
  app.append(h("h2", {}, `5. Job board of ${dockLabel(s.currentDockId)}`));
  const board: BoardEntry[] = game.getBoard();
  if (flying) app.append(h("p", { class: "note" }, "No board while you are flying."));
  else if (board.length === 0) app.append(h("p", { class: "note" }, "This board is empty."));
  else {
    const t = h("table");
    t.append(h("tr", {}, ...["Kind", "Load", "To", "Stops", "Distance", "Reward", "Trip", "Fuel", "Status", ""].map((x) => h("th", {}, x))));
    for (const e of board) {
      const j = e.job;
      const tr = h("tr");
      const act = h("td");
      act.append(
        button("Accept", () => {
          const r = game.accept(j.id);
          say(r.ok ? "Job accepted." : r.block.text);
        }, { disabled: e.block !== null }),
      );
      tr.append(
        h("td", {}, j.kind),
        h("td", {}, `${j.amount} x ${j.itemName}`),
        h("td", {}, dockLabel(j.destinationDockId)),
        h("td", {}, j.stops.length > 1 ? j.stops.map(dockLabel).join(" > ") : "1"),
        h("td", {}, `${j.totalDistance} ly`),
        h("td", {}, `${j.reward} cr`),
        h("td", {}, formatDuration(e.tripSeconds)),
        h("td", {}, String(e.fuelNeeded)),
        e.block ? h("td", { class: "bad" }, `BLOCKED [${e.block.code}]: ${e.block.text}`) : h("td", { class: "ok" }, "can take"),
        act,
      );
      t.append(tr);
    }
    app.append(h("div", { class: "scroll" }, t));
  }
}

/** Updates the "arrives in" text (real seconds left), without rebuilding the page. */
function tick(): void {
  const p = game.progress();
  if (countdownEl && p) countdownEl.textContent = formatDuration(p.remainingMs / 1000 / speed);
}

window.setInterval(() => {
  game.update(); // arrival redraws the page through the subscription
  tick();
}, 500);

render();
