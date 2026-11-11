// The /game-debug.html test page: plain text and buttons. It makes its OWN Game (never the live one).
// No Three.js, no menus. Buttons marked TEST break the normal rules so Andy can try everything quickly.

import {
  Game,
  checkJob,
  createClock,
  formatDuration,
  getShip,
  LIVERY_PRICE,
  parseSpeedParam,
  tripFuelCost,
  type BoardEntry,
  type GameClock,
} from "./game";
import {
  browserPageEvents,
  checkSaveData,
  getBrowserStorage,
  loadIntoGame,
  makeSaveData,
  migrateSave,
  readSave,
  startAutoSave,
  universeVersionOf,
  type AutoSaver,
  type SaveData,
  type StorageLike,
} from "./save";
import {
  UNIVERSE_VERSION,
  distanceBetweenSystems,
  docksOf,
  generateJobBoard,
  getDock,
  getJobBoard,
  getPlanet,
  getPlanetsOfSystem,
  getSystem,
  listSystemsNear,
  startDockOf,
  type Seed,
} from "./universe";

const HOUR_MS = 3_600_000;
const seedMatch = /[?&]seed=(-?\d{1,12})(?:&|$)/.exec(window.location.search);
const seed: Seed = seedMatch && seedMatch[1] !== undefined ? Number(seedMatch[1]) : 12345;
const speed = parseSpeedParam(window.location.search);

// ------------------------------------------------------------ the page's own game and clock

function findStartDockId(): string {
  return startDockOf(seed).id; // the same start dock the real game uses
}

let offsetMs = 0; // TEST buttons move game time forward by changing this
const baseClock = createClock(speed);
const clock: GameClock = { speed, now: () => baseClock.now() + offsetMs };

// This page saves in its OWN place in the browser (keys start with "gamedebug."),
// so trying things here never touches the real game's save. Reloading the page keeps your test game.
function prefixed(storage: StorageLike, prefix: string): StorageLike {
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
  };
}
const browserStorage = getBrowserStorage();
const storage: StorageLike | null = browserStorage ? prefixed(browserStorage, "gamedebug.") : null;
let saver: AutoSaver | null = null;

let startNotice: string | null = null; // set when a loaded save was from an older universe and was moved
let game = makeGame(true);
let message = startNotice ?? (storage ? "Welcome. This page saves its own test game, so a reload keeps it." : "Welcome. Saving is off in this browser.");

function makeGame(tryLoad: boolean): Game {
  saver?.stop(); // the old game must not be written over the new one
  const startDockId = findStartDockId();
  const g = new Game(seed, startDockId, clock);
  if (tryLoad) {
    const saved = readSave(storage);
    if (saved.kind === "ok" && saved.data.seed === seed && saved.data.state) {
      // A save from an older universe is moved first (same rules as the real game), and the message is shown once.
      const moved = migrateSave(saved.data);
      if (moved.message) startNotice = moved.message;
      if (moved.data.state) loadIntoGame(g, moved.data, moved.data.state, startDockId, Date.now());
    }
  }
  g.subscribe(() => render());
  saver = startAutoSave(g, storage, tryLoad ? browserPageEvents() : null);
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

/** The name of a dock, or of a planet without a dock, with its star system. */
function placeLabel(id: string): string {
  const dock = getDock(seed, id);
  if (dock) return dockLabel(id);
  const planet = getPlanet(seed, id);
  const system = planet ? getSystem(seed, planet.systemId) : null;
  return planet ? `${planet.name} (${system?.name ?? "?"}, no dock)` : id;
}

function say(text: string): void {
  message = text;
  saver?.saveNow(); // TEST buttons change the state directly, so save here too
  render();
}

// ------------------------------------------------------------ the dock chooser (TEST teleport)

let dockCacheKey = "";
let dockCache: { id: string; text: string }[] = [];

/** Docks near the start, with how many passenger and tour jobs the active ship could take there with a full tank. */
function dockList(): { id: string; text: string }[] {
  const slot = game.currentSlot();
  const key = `${seed}|${slot}|${game.state.shipId}|${game.state.ownedOutposts.join(",")}|${JSON.stringify(game.state.shipUpgrades)}`;
  if (key === dockCacheKey) return dockCache;
  const list: { id: string; text: string }[] = [];
  const tank = game.getShipStats().fuelTankSize;
  for (const system of listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 30).slice(0, 25)) {
    for (const dock of docksOf(seed, system)) {
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
      const offer = game.getOutpostOffer(dock.id);
      const place = offer.isOutpost ? `OUTPOST ${offer.price} cr${offer.owned ? " (yours)" : ""}` : "station";
      list.push({ id: dock.id, text: `${dock.name} (${system.name}, ${system.planetCount} planets, ${docksOf(seed, system).length} dock(s)) - ${place} - passenger jobs: ${passengers}, tours: ${tours}` });
    }
  }
  dockCacheKey = key;
  dockCache = list;
  return list;
}


// ------------------------------------------------------------ old saves (universe version 1)

/** Moves an old save to the current universe the same way the real game does, and plays it here. */
function playMovedSave(save: SaveData): void {
  if (save.seed !== Number(seed)) {
    say(`That save is for seed ${save.seed}, this page uses seed ${seed}. Open this page with ?seed=${save.seed} first.`);
    return;
  }
  const moved = migrateSave(save);
  if (!moved.data.state) {
    say("That save held no progress, so there is nothing to move.");
    return;
  }
  offsetMs = 0;
  game = makeGame(false);
  loadIntoGame(game, moved.data, moved.data.state, findStartDockId(), Date.now());
  dockCacheKey = "";
  say(moved.message ?? "That save was already current: loaded as it is.");
}

/** A made-up save as universe version 1 wrote it: an old dock id, a job in flight, two outposts, no universeVersion. */
function sampleOldSave(): SaveData {
  const here = game.state.currentDockId;
  const job = (getJobBoard(seed, here, game.currentSlot()) ?? [])[0] ?? null;
  const outposts: string[] = [];
  for (const system of listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 40)) {
    for (const dock of docksOf(seed, system)) {
      if (dock.kind === "OUTPOST" && outposts.length < 2) outposts.push(dock.id);
    }
  }
  const now = clock.now();
  const state = {
    ...game.state,
    currentDockId: "1:1:1:0/6", // a dock of the OLD universe: it does not exist now
    currentJob: job,
    travelStartMs: job ? now : null,
    travelEndMs: job ? now + 3 * HOUR_MS : null,
    ownedOutposts: outposts,
    outpostCount: outposts.length,
    outpostPrices: {},
    deliveredJobIds: ["old-1", "old-2"],
  };
  const { universeVersion: _drop, ...old } = makeSaveData(Number(seed), state, now, Date.now());
  void _drop;
  return old;
}

let pastedSaveText = "";

// ------------------------------------------------------------ drawing the page

let countdownEl: HTMLElement | null = null;
let pendingSelect = "";

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;
  const s = game.state;
  const ship = getShip(s.shipId);
  const flying = s.currentJob !== null || s.freeTrip !== null;
  const stuck = game.isStuck();
  const explorer = game.getExplorer();
  app.replaceChildren();
  countdownEl = null;

  // Status
  const owned = [`${ship.name} (active, fuel ${s.fuel}/${game.getShipStats().fuelTankSize})`];
  for (const [id, entry] of Object.entries(s.ownedShips)) owned.push(`${getShip(id).name} (fuel ${entry.fuel}/${game.getShipStats(id).fuelTankSize})`);
  const status = h("div", { class: "box" });
  status.append(
    h("div", {}, `Credits: ${s.credits}   |   Fuel: ${s.fuel}/${game.getShipStats().fuelTankSize}   |   Active ship: ${ship.name}`),
    h("div", {}, `Owned ships: ${owned.join("; ")}`),
    h("div", {}, s.spacePlanetId !== null && !flying
      ? `Location: FLOATING IN SPACE at ${placeLabel(s.spacePlanetId)} (last dock: ${dockLabel(s.currentDockId)})   |   Game speed: x${speed}   |   Time slot: ${game.currentSlot()}`
      : `Dock: ${dockLabel(s.currentDockId)}   |   Game speed: x${speed}   |   Time slot: ${game.currentSlot()}`),
    h("div", {}, `Explorer: ${explorer.systems} systems and ${explorer.planets} planets explored = ${explorer.discoveries} discoveries   |   Rank ${explorer.rankNumber}: ${explorer.rankName}   |   Discovery bonus +${explorer.discoveryBonusPercent}%   |   Next: ${explorer.nextRankName ?? "(top rank)"}${explorer.discoveriesToNext === null ? "" : ` in ${explorer.discoveriesToNext} discoveries`}`),
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
  } else if (flying && s.freeTrip) {
    const line = h("div", {}, `Free trip (no job) to ${placeLabel(s.freeTrip.toId)}, ${s.freeTrip.distanceLy.toFixed(1)} ly. Arrives in `);
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
      const free = game.lastFreeArrival;
      say(
        arrival
          ? `Arrived! Paid ${arrival.reward} credits${arrival.discovery > 0 ? ` + ${arrival.discovery} discovery credits` : ""}. ${arrival.debrief}`
          : free
            ? `Arrived. ${free.line}${free.discovery > 0 ? ` +${free.discovery} discovery credits.` : ""}`
            : "Not there yet.",
      );
    }, { test: true, disabled: !flying }),
    button("TEST: next job board (+6 game hours)", () => {
      if (flying) return say("Not during a flight.");
      offsetMs += 6 * HOUR_MS;
      say("Moved 6 game hours ahead. The board may have changed.");
    }, { test: true, disabled: flying }),
    button("TEST: start a new game", () => {
      offsetMs = 0;
      game = makeGame(false);
      dockCacheKey = "";
      say("New game started.");
    }, { test: true }),
  );
  app.append(row, h("div", { class: "msg" }, message));

  if (game.lastArrival && !flying) {
    const a = game.lastArrival;
    app.append(h("div", { class: "debrief" }, `Last delivery: +${a.reward} credits${a.discovery > 0 ? ` and +${a.discovery} discovery credits (new star system)` : ""}. ${a.debrief}${a.explorerRankUp ? ` EXPLORER RANK UP: ${a.explorerRankUp.rankName}!` : ""}`));
  }
  if (game.lastFreeArrival && !flying) {
    const f = game.lastFreeArrival;
    app.append(h("div", { class: "debrief" }, `Last free trip: ${f.line}${f.discovery > 0 ? ` +${f.discovery} discovery credits (new star system).` : ""}${f.explorerRankUp ? ` EXPLORER RANK UP: ${f.explorerRankUp.rankName}!` : ""}`));
  }

  // Free travel and exploring (stage F1)
  app.append(h("h2", {}, "10. Free travel and exploring (no job)"));
  app.append(freeTravelBox(flying));

  // Paint jobs (stage 4g)
  app.append(h("h2", {}, "11. Paint jobs (cosmetic only)"));
  app.append(paintJobsBox());

  // Ship catalog
  app.append(h("h2", {}, "3. Ship catalog (numbers include upgrades)"));
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
      h("td", {}, String(entry.stats.cargoCapacity)),
      h("td", {}, String(entry.stats.cabinCapacity)),
      h("td", {}, String(entry.stats.fuelTankSize)),
      h("td", {}, entry.owned ? `yes (fuel ${entry.fuel ?? "?"})` : "no"),
      h("td", {}, entry.active ? "ACTIVE" : ""),
      h("td", {}, entry.canBuy ? "yes" : "no"),
      h("td", {}, entry.reason),
      actions,
    );
    shipTable.append(tr);
  }
  app.append(h("div", { class: "scroll" }, shipTable));

  // Upgrades
  app.append(h("h2", {}, "4. Ship upgrades (every ship you own keeps its own)"));
  app.append(h("div", { class: "note" }, "Use TEST: add 50000 credits (section 2) first. Prices: 1500, 4000, 9000, 18000, 35000 per level."));
  for (const entry of game.getShipCatalog().filter((e) => e.owned)) {
    const st = entry.stats;
    const levels = entry.upgrades;
    app.append(
      h("div", { class: "box" },
        `${entry.ship.name}${entry.active ? " (ACTIVE)" : ""}: cargo ${st.cargoCapacity}, cabin ${st.cabinCapacity}, tank ${st.fuelTankSize}, fuel burn ${st.fuelBurnPercent}% of normal, comfort pay +${st.comfortBonusPercent}%   [levels: tank ${levels.tank}, hold ${levels.hold}, engines ${levels.engines}, comfort ${levels.comfort}]`,
      ),
    );
    const upTable = h("table");
    upTable.append(h("tr", {}, ...["Upgrade", "Level", "Next level does", "Price", "Reason", ""].map((t) => h("th", {}, t))));
    for (const o of game.getUpgradeOffers(entry.ship.id)) {
      const act = h("td");
      act.append(
        button("Buy level", () => {
          const r = game.buyUpgrade(entry.ship.id, o.track);
          say(r.ok ? `${r.line} (${r.price} cr)` : r.reason);
        }, { disabled: !o.canBuy }),
      );
      upTable.append(
        h("tr", {},
          h("td", {}, o.name),
          h("td", {}, `${o.level} / ${o.maxLevel}`),
          h("td", {}, o.effect),
          h("td", {}, o.nextPrice === null ? "-" : String(o.nextPrice)),
          h("td", {}, o.reason),
          act,
        ),
      );
    }
    app.append(h("div", { class: "scroll" }, upTable));
  }

  // Dock chooser
  app.append(h("h2", {}, "5. Where am I? (TEST teleport)"));
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
      if (flying) return say("Not during a flight.");
      game.state = { ...game.state, currentDockId: select.value, spacePlanetId: null };
      pendingSelect = "";
      say(`Teleported to ${dockLabel(select.value)}.`);
    }, { test: true, disabled: flying }),
  );
  app.append(chooser);

  // Ranks
  app.append(h("h2", {}, "6. Ranks"));
  const rankTable = h("table");
  rankTable.append(h("tr", {}, ...["Category", "Jobs done", "Rank", "Next rank", "Jobs to go", "Pay bonus", "Biggest job allowed"].map((t) => h("th", {}, t))));
  for (const r of game.getRanks()) {
    rankTable.append(
      h("tr", {},
        h("td", {}, r.label),
        h("td", {}, String(r.jobsDone)),
        h("td", {}, `${r.rankNumber}: ${r.rankName}`),
        h("td", {}, r.nextRankName ?? "(top rank)"),
        h("td", {}, r.jobsToNext === null ? "-" : String(r.jobsToNext)),
        h("td", {}, `+${r.rewardBonusPercent}%`),
        h("td", {}, r.maxReward === null ? "no limit" : `${r.maxReward} cr`),
      ),
    );
  }
  const rankRow = h("div", { class: "box" });
  for (const [kind, label] of [["TRADE", "cargo"], ["PASSENGER", "passenger"], ["TOUR", "tour"]] as const) {
    rankRow.append(
      button(`TEST: +4 ${label} jobs done`, () => {
        game.state = { ...game.state, completedJobs: { ...game.state.completedJobs, [kind]: game.state.completedJobs[kind] + 4 } };
        say(`Added 4 delivered ${label} jobs.`);
      }, { test: true }),
    );
  }
  rankRow.append(
    button("TEST: top rank everywhere", () => {
      game.state = { ...game.state, completedJobs: { TRADE: 99, PASSENGER: 99, TOUR: 99 } };
      say("All ranks are at the top.");
    }, { test: true }),
    button("TEST: back to rank 1", () => {
      game.state = { ...game.state, completedJobs: { TRADE: 0, PASSENGER: 0, TOUR: 0 } };
      say("All ranks reset.");
    }, { test: true }),
  );
  app.append(h("div", { class: "scroll" }, rankTable), rankRow);

  // Outposts
  app.append(h("h2", {}, "7. Outposts"));
  const offer = game.getOutpostOffer(s.currentDockId);
  const perks = game.getPerks();
  const outBox = h("div", { class: "box" });
  outBox.append(
    h("div", {}, `This dock: ${offer.dockName} (${offer.systemName}) - ${offer.isOutpost ? `an outpost, price ${offer.price} cr` : "a station (not for sale)"}${offer.owned ? " - YOURS" : ""}`),
    h("div", { class: offer.canBuy ? "ok" : "note" }, offer.canBuy ? "You can buy it now." : offer.reason),
    h("div", {}, `Perks active in this star system: fuel ${perks.fuelDiscountPercent}% cheaper, jobs ending here pay +${perks.deliveryBonusPercent}%`),
    button(`Buy this outpost${offer.price !== null ? ` (${offer.price} cr)` : ""}`, () => {
      const r = game.buyOutpost(s.currentDockId);
      say(r.ok ? `Bought for ${r.price} cr. ${r.line}` : r.reason);
    }, { disabled: !offer.canBuy }),
    button("TEST: add 50000 credits", () => {
      game.state = { ...game.state, credits: game.state.credits + 50000 };
      say("Added 50000 credits.");
    }, { test: true }),
  );
  const mine = game.getOwnedOutposts();
  outBox.append(h("div", {}, mine.length === 0 ? "You own no outposts yet." : `You own ${mine.length}: ${mine.map((o) => `${o.dockName} (${o.systemName})`).join("; ")}`));
  app.append(outBox);

  // Old saves
  app.append(h("h2", {}, `9. Old saves (universe version 1 -> ${UNIVERSE_VERSION})`));
  const oldBox = h("div", { class: "box" });
  oldBox.append(
    h("div", { class: "note" }, "An old save keeps credits, ranks, ships and upgrades. The ship moves to the start dock, a job in flight is cancelled (fuel back), each outpost is refunded and the delivered list is cleared."),
    button("TEST: turn this game into an OLD save and load it", () => playMovedSave(sampleOldSave()), { test: true }),
  );
  const box = h("textarea");
  box.rows = 4;
  box.cols = 60;
  box.placeholder = "Or paste a whole old save here (the text from localStorage lazy-freight.save)";
  box.value = pastedSaveText;
  box.addEventListener("input", () => (pastedSaveText = box.value));
  oldBox.append(
    box,
    button("Load pasted save", () => {
      try {
        const parsed: unknown = JSON.parse(pastedSaveText);
        const bad = checkSaveData(parsed);
        if (bad) {
          say(`That is not a usable save: ${bad}.`);
          return;
        }
        const save = parsed as SaveData;
        say(`Save is from universe version ${universeVersionOf(save)}.`);
        playMovedSave(save);
      } catch {
        say("That text is not a save (it is not valid JSON).");
      }
    }),
  );
  app.append(oldBox);

  // Job board
  app.append(h("h2", {}, `8. Job board of ${dockLabel(s.currentDockId)}`));
  const board: BoardEntry[] = game.getBoard();
  if (flying) app.append(h("p", { class: "note" }, "No board while you are flying."));
  else if (s.spacePlanetId !== null) app.append(h("p", { class: "note" }, game.whyNotDocked() ?? "No board while you float in space."));
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
        h("td", {}, e.bonusPercent > 0 ? `${j.reward} cr (base ${e.baseReward} + ${e.bonusPercent}%)` : `${j.reward} cr`),
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

/** The paint jobs section: every ship you own, its four paint jobs (ids only: the names live in the picture code), buy and wear. */
function paintJobsBox(): HTMLElement {
  const box = h("div", { class: "box" });
  box.append(h("div", { class: "note" }, `Every extra paint job costs ${LIVERY_PRICE} credits. The standard paint is free. Buying needs a dock. Putting on paint you own is free. Paint changes only the looks.`));
  const owned = [game.state.shipId, ...Object.keys(game.state.ownedShips)];
  for (const shipId of owned) {
    const ship = getShip(shipId);
    box.append(h("h3", {}, `${ship?.name ?? shipId}${shipId === game.state.shipId ? " (active)" : ""}: wears "${game.currentLivery(shipId)}"`));
    const table = h("table");
    table.append(h("tr", {}, ...["Paint job", "Owned", "Worn", "Price", "Reason", ""].map((t) => h("th", {}, t))));
    for (const row of game.getLiveryCatalog(shipId)) {
      const tr = h("tr");
      const actions = h("td");
      actions.append(
        button("Buy", () => {
          const r = game.buyLivery(shipId, row.id);
          say(r.ok ? `Bought the "${row.id}" paint for ${r.price} credits.` : r.reason);
        }, { disabled: !row.canBuy }),
        button("Wear", () => {
          const r = game.setLivery(shipId, row.id);
          say(r.ok ? `The ${ship?.name ?? shipId} now wears "${row.id}".` : r.reason);
        }, { disabled: !row.canWear }),
        // Not disabled on purpose: pressing it shows the plain refusal text.
        button("Try buy", () => {
          const r = game.buyLivery(shipId, row.id);
          say(r.ok ? `Bought "${row.id}" for ${r.price} credits.` : r.reason);
        }, { test: true }),
      );
      for (const cell of [row.id, row.owned ? "yes" : "no", row.worn ? "WORN" : "", row.price === 0 ? "free" : String(row.price), row.reason]) tr.append(h("td", {}, cell));
      tr.append(actions);
      table.append(tr);
    }
    box.append(table);
  }
  return box;
}

/** The free-travel section: places to fly to (this star system and the nearest others), with the plain numbers and reasons. */
function freeTravelBox(flying: boolean): HTMLElement {
  const box = h("div", { class: "box" });
  box.append(
    h("div", { class: "note" }, "Fly to a dock or to a planet without a dock, with no job. You pay fuel only. A trip is refused if you could not reach a dock afterwards. The first arrival in a star system pays 50 to 100 discovery credits, once."),
  );
  const row = h("div");
  row.append(
    button("TEST: set fuel to 3", () => {
      game.state = { ...game.state, fuel: 3 };
      say("Fuel set to 3.");
    }, { test: true }),
    button("TEST: set fuel to exactly what the nearest other star system needs (so that trip would strand you)", () => {
      const from = getSystem(seed, game.currentSystemId());
      const near = from ? listSystemsNear(seed, from.position, 40).find((x) => x.id !== from.id) : undefined;
      if (!from || !near) return say("No other star system is near.");
      const need = tripFuelCost(game.state, distanceBetweenSystems(seed, from.id, near.id) ?? 0);
      game.state = { ...game.state, fuel: need };
      say(`Fuel set to ${need}: exactly the trip to ${near.name}. The game should refuse it (you would arrive with 0).`);
    }, { test: true }),
    button("TEST: add 24 made-up explored systems (48 discoveries: the next arrival ranks up)", () => {
      const fake: Record<string, number> = { ...game.state.explored };
      for (let i = 0; i < 24; i++) fake[`fake:${i}`] = 1;
      game.state = { ...game.state, explored: fake };
      say("Added 24 made-up systems.");
    }, { test: true }),
    button("TEST: forget everything explored", () => {
      game.state = { ...game.state, explored: {} };
      say("Explored list cleared.");
    }, { test: true }),
    button("TEST: show the explored list as saved", () => {
      const text = JSON.stringify(game.state.explored);
      say(`Explored list (${Object.keys(game.state.explored).length} systems, ${text.length} characters): ${text.length > 300 ? `${text.slice(0, 300)}...` : text}`);
    }, { test: true }),
  );
  box.append(row);

  const here = getSystem(seed, game.currentSystemId());
  if (!here) return box;
  const systems = [here, ...listSystemsNear(seed, here.position, 40).filter((x) => x.id !== here.id).slice(0, 6)];
  const table = h("table");
  table.append(h("tr", {}, ...["Place", "What", "Star system", "Distance", "Trip", ""].map((t) => h("th", {}, t))));
  for (const system of systems) {
    const dockIds = new Set(docksOf(seed, system).map((d) => d.id));
    for (const planet of getPlanetsOfSystem(seed, system.id)) {
      const isDock = dockIds.has(planet.id);
      const dock = isDock ? getDock(seed, planet.id) : null;
      const check = game.canFreeTravel(planet.id);
      const ly = distanceBetweenSystems(seed, game.currentSystemId(), system.id) ?? 0;
      const act = h("td");
      act.append(
        button("Fly here", () => {
          const r = game.freeTravel(planet.id);
          say(r.ok ? `Flying to ${placeLabel(planet.id)}: fuel -${r.fuelUsed}, ${formatDuration(r.seconds)}.` : r.reason);
        }, { disabled: flying || !check.ok, title: check.ok ? "" : check.reason }),
      );
      table.append(
        h("tr", {},
          h("td", {}, dock ? dock.name : planet.name),
          h("td", {}, dock ? `${dock.kind.toLowerCase()} on ${planet.name}` : `planet without a dock (${planet.type.toLowerCase()})`),
          h("td", {}, `${system.name}${system.id === here.id ? " (here)" : ""}`),
          h("td", {}, `${ly.toFixed(1)} ly`),
          check.ok
            ? h("td", { class: "ok" }, `fuel ${check.fuelNeeded}, left ${check.fuelLeft}, ${formatDuration(check.seconds)}${check.newSystem ? `, NEW SYSTEM +${check.discoveryCredits} cr` : ""}`)
            : h("td", { class: "bad" }, check.reason),
          act,
        ),
      );
    }
  }
  box.append(h("div", { class: "scroll" }, table));
  return box;
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
