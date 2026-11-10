import { describe, expect, it } from "vitest";
import {
  Game,
  SHIP_ORDER,
  UPGRADE_COMFORT_PERCENT_PER_LEVEL,
  UPGRADE_ENGINE_PERCENT_PER_LEVEL,
  UPGRADE_HOLD_PERCENT_PER_LEVEL,
  UPGRADE_MAX_LEVEL,
  UPGRADE_PRICES,
  UPGRADE_TANK_PERCENT_PER_LEVEL,
  UPGRADE_TRACKS,
  acceptJob,
  checkJob,
  createClock,
  emergencyRefuel,
  fuelCost,
  getShip,
  isStuck,
  newGameState,
  normalizeState,
  refuel,
  settleArrival,
  shipCatalog,
  shipStats,
  switchShip,
  tripFuelCost,
  upgradeLevels,
  upgradeOffers,
  withBonuses,
  type GameState,
  type UpgradeTrack,
} from "../src/game";
import { generateDock, generateJobBoard, getPlanetsOfSystem, listSystemsNear, type Dock, type Job } from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };
const TOP = { TRADE: 99, PASSENGER: 99, TOUR: 99 };

const docks: Dock[] = [];
for (const system of listSystemsNear(SEED, ORIGIN, 40).slice(0, 14)) {
  for (const planet of getPlanetsOfSystem(SEED, system.id)) docks.push(generateDock(SEED, planet));
}
const JOBS: Job[] = docks.flatMap((d) => [0, 6, 13].flatMap((slot) => generateJobBoard(SEED, d, slot)));

const newGame = (): Game => new Game(SEED, docks[0]!.id, createClock(1, () => 0));
/** A game with lots of credits and every ship owned. */
function richGame(): Game {
  const g = newGame();
  g.state = { ...g.state, credits: 1_000_000, completedJobs: TOP, ownedShips: { "passenger-liner": { fuel: 100 }, scout: { fuel: 110 } } };
  return g;
}
const at = (job: Job, patch: Partial<GameState> = {}): GameState => ({ ...newGameState(job.originDockId), completedJobs: TOP, ...patch });
const withLevels = (state: GameState, shipId: string, patch: Partial<Record<UpgradeTrack, number>>): GameState => ({
  ...state,
  shipUpgrades: { ...state.shipUpgrades, [shipId]: { tank: 0, hold: 0, engines: 0, comfort: 0, ...patch } },
});

describe("upgrades: levels, prices and numbers", () => {
  it("starts with no upgrades and the shipyard numbers", () => {
    const g = newGame();
    for (const o of g.getUpgradeOffers()) {
      expect(o.level).toBe(0);
      expect(o.maxLevel).toBe(5);
      expect(o.nextPrice).toBe(UPGRADE_PRICES[0]);
    }
    const stats = g.getShipStats();
    expect(stats.fuelTankSize).toBe(getShip("cargo-hauler").fuelTankSize);
    expect(stats.cargoCapacity).toBe(30);
    expect(stats.fuelBurnPercent).toBe(100);
    expect(stats.comfortBonusPercent).toBe(0);
  });

  it("has the five approved prices, in order", () => {
    expect([...UPGRADE_PRICES]).toEqual([1500, 4000, 9000, 18000, 35000]);
    expect(UPGRADE_MAX_LEVEL).toBe(5);
    expect(UPGRADE_TRACKS).toHaveLength(4);
  });

  it("buying walks up the price list, one level at a time, and takes the credits", () => {
    const g = richGame();
    let credits = g.state.credits;
    for (let level = 1; level <= 5; level++) {
      const r = g.buyUpgrade("cargo-hauler", "tank");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.level).toBe(level);
        expect(r.price).toBe(UPGRADE_PRICES[level - 1]);
        expect(r.line.length).toBeGreaterThan(5);
        expect(r.line).not.toContain("{");
      }
      credits -= UPGRADE_PRICES[level - 1]!;
      expect(g.state.credits).toBe(credits);
    }
    expect(upgradeLevels(g.state).tank).toBe(5);
  });

  it("tank: +10% per level, up to +50%", () => {
    for (const id of SHIP_ORDER) {
      const base = getShip(id).fuelTankSize;
      for (let l = 0; l <= 5; l++) {
        const s = shipStats(withLevels(richGame().state, id, { tank: l }), id);
        expect(s.fuelTankSize).toBe(Math.round(base * (100 + l * UPGRADE_TANK_PERCENT_PER_LEVEL) / 100));
      }
    }
  });

  it("hold: +10% cargo and cabin per level, and no cabin is never created", () => {
    const hauler = shipStats(withLevels(richGame().state, "cargo-hauler", { hold: 5 }), "cargo-hauler");
    expect(hauler.cargoCapacity).toBe(45);
    expect(hauler.cabinCapacity).toBe(0);
    const liner = shipStats(withLevels(richGame().state, "passenger-liner", { hold: 5 }), "passenger-liner");
    expect(liner.cabinCapacity).toBe(18);
    expect(liner.cargoCapacity).toBe(9);
    const scout = (l: number): number => shipStats(withLevels(richGame().state, "scout", { hold: l }), "scout").cabinCapacity;
    expect([0, 1, 2, 3, 4, 5].map(scout)).toEqual([2, 2, 2, 3, 3, 3]);
    expect(UPGRADE_HOLD_PERCENT_PER_LEVEL).toBe(10);
  });

  it("engines: -6% fuel per light year per level, never below 1 fuel and unchanged at level 0", () => {
    expect(fuelCost(10)).toBe(20);
    expect(fuelCost(10, 100)).toBe(20);
    expect(fuelCost(10, 70)).toBe(14);
    expect(fuelCost(25, 70)).toBe(35);
    expect(fuelCost(0.1, 70)).toBe(1);
    const s = withLevels(richGame().state, "cargo-hauler", { engines: 5 });
    expect(shipStats(s).fuelBurnPercent).toBe(100 - 5 * UPGRADE_ENGINE_PERCENT_PER_LEVEL);
    expect(tripFuelCost(s, 20)).toBe(28);
    // a better engine never burns more than a worse one, for any distance
    for (let d = 0; d <= 25; d += 0.37) {
      let prev = Infinity;
      for (let l = 0; l <= 5; l++) {
        const f = tripFuelCost(withLevels(richGame().state, "cargo-hauler", { engines: l }), d);
        expect(f).toBeLessThanOrEqual(prev);
        prev = f;
      }
    }
  });

  it("comfort: shows its percent, +6% per level", () => {
    const s = withLevels(richGame().state, "passenger-liner", { comfort: 3 });
    expect(shipStats(s, "passenger-liner").comfortBonusPercent).toBe(3 * UPGRADE_COMFORT_PERCENT_PER_LEVEL);
  });
});

describe("upgrades: refusals", () => {
  it("refuses when you are poor, with the price in the reason", () => {
    const g = newGame();
    const r = g.buyUpgrade("cargo-hauler", "tank");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("1500");
    expect(g.state.credits).toBe(200);
  });

  it("refuses above level 5, for an unknown ship or track, a ship you do not own, and during a flight", () => {
    const g = richGame();
    for (let i = 0; i < 5; i++) g.buyUpgrade("scout", "hold");
    const credits = g.state.credits;
    expect(g.buyUpgrade("scout", "hold")).toMatchObject({ ok: false });
    expect(g.buyUpgrade("nope", "tank")).toMatchObject({ ok: false });
    expect(g.buyUpgrade("scout", "wings")).toMatchObject({ ok: false });
    const poorOwner = newGame();
    poorOwner.state = { ...poorOwner.state, credits: 999_999 };
    expect(poorOwner.buyUpgrade("scout", "tank")).toMatchObject({ ok: false, reason: "You do not own this ship." });
    expect(g.state.credits).toBe(credits);
    const job = JOBS.find((j) => !checkJob(at(j), j))!;
    const flying = richGame();
    flying.state = { ...at(job, { credits: 999_999 }), currentJob: job, travelStartMs: 0, travelEndMs: 1000 };
    expect(flying.buyUpgrade("cargo-hauler", "tank")).toMatchObject({ ok: false, reason: "You cannot buy an upgrade during a flight." });
  });

  it("offers say canBuy and the reason, and never throw for an unknown ship", () => {
    const g = newGame();
    expect(g.getUpgradeOffers().every((o) => !o.canBuy && o.reason.length > 0)).toBe(true);
    expect(g.getUpgradeOffers("nope")).toHaveLength(4);
    const r = richGame();
    expect(r.getUpgradeOffers().every((o) => o.canBuy && o.reason === "")).toBe(true);
    const maxed = richGame();
    for (const t of UPGRADE_TRACKS) for (let i = 0; i < 5; i++) maxed.buyUpgrade("cargo-hauler", t);
    for (const o of maxed.getUpgradeOffers()) {
      expect(o.nextPrice).toBeNull();
      expect(o.canBuy).toBe(false);
      expect(o.effect).toContain("maximum");
    }
  });

  it("effect texts show real numbers", () => {
    const offers = Object.fromEntries(richGame().getUpgradeOffers("passenger-liner").map((o) => [o.track, o.effect]));
    expect(offers["tank"]).toBe("Tank 100 -> 110 fuel");
    expect(offers["hold"]).toBe("Cargo 6 -> 7, cabin 12 -> 13");
    expect(offers["engines"]).toBe("Fuel burn 100% -> 94% of normal");
    expect(offers["comfort"]).toBe("Passenger and tour pay +0% -> +6%");
    expect(richGame().getUpgradeOffers("cargo-hauler").find((o) => o.track === "hold")?.effect).toBe("Cargo 30 -> 33, no cabin");
  });
});

describe("upgrades: stay with the ship", () => {
  it("each ship has its own levels, and switching switches them", () => {
    const g = richGame();
    g.buyUpgrade("cargo-hauler", "tank");
    g.buyUpgrade("scout", "engines");
    g.buyUpgrade("scout", "engines");
    expect(g.getShipStats("cargo-hauler").fuelTankSize).toBe(66);
    expect(g.getShipStats("scout").fuelBurnPercent).toBe(88);
    expect(g.getShipStats("passenger-liner").fuelBurnPercent).toBe(100);
    expect(g.switchShip("scout").ok).toBe(true);
    expect(g.getShipStats().fuelBurnPercent).toBe(88); // the active ship is now the scout
    expect(g.getUpgradeOffers().find((o) => o.track === "engines")?.level).toBe(2);
    expect(g.getUpgradeOffers("cargo-hauler").find((o) => o.track === "tank")?.level).toBe(1);
  });

  it("the shipyard catalog shows real stats and levels", () => {
    const g = richGame();
    g.buyUpgrade("passenger-liner", "tank");
    const row = shipCatalog(g.state).find((e) => e.ship.id === "passenger-liner")!;
    expect(row.stats.fuelTankSize).toBe(110);
    expect(row.upgrades.tank).toBe(1);
    expect(row.ship.fuelTankSize).toBe(100); // the base number is unchanged
  });

  it("buying a bigger tank does not refill it", () => {
    const g = richGame();
    g.state = { ...g.state, fuel: 20 };
    g.buyUpgrade("cargo-hauler", "tank");
    expect(g.state.fuel).toBe(20);
    expect(g.getShipStats().fuelTankSize).toBe(66);
  });
});

describe("upgrades: used by the whole job path", () => {
  it("a bigger hold lets you take cargo the base ship cannot", () => {
    const job = JOBS.find((j) => j.requiredHold !== "PASSENGER_CABIN" && j.amount > 30 && j.amount <= 33 && fuelCost(j.totalDistance) <= 60);
    expect(job).toBeDefined();
    if (!job) return;
    const base = at(job);
    expect(checkJob(base, job)?.code).toBe("cargo-too-large");
    expect(checkJob(withLevels(base, "cargo-hauler", { hold: 1 }), job)).toBeNull();
  });

  it("a bigger tank lets you take a trip that was too far", () => {
    // Only tours are long enough to beat a tank, so look for one the Passenger Liner can seat but not fuel.
    const ship = getShip("passenger-liner");
    const job = JOBS.find((j) => j.requiredHold === "PASSENGER_CABIN" && j.amount <= ship.cabinCapacity && fuelCost(j.totalDistance) > ship.fuelTankSize && fuelCost(j.totalDistance) <= ship.fuelTankSize * 1.5);
    expect(job).toBeDefined();
    if (!job) return;
    const need = fuelCost(job.totalDistance);
    const level = Math.ceil(((need / ship.fuelTankSize) * 100 - 100) / UPGRADE_TANK_PERCENT_PER_LEVEL);
    const base = { ...at(job), shipId: "passenger-liner", fuel: need };
    expect(checkJob(base, job)?.code).toBe("tank-too-small");
    expect(checkJob(withLevels(base, "passenger-liner", { tank: 5 }), job)).toBeNull();
    // and it needs enough levels: one level fewer than the smallest working tank is still too small
    let enough = 0;
    while (enough < 5 && checkJob(withLevels(base, "passenger-liner", { tank: enough }), job) !== null) enough++;
    expect(enough).toBeGreaterThanOrEqual(1);
    expect(enough).toBeLessThanOrEqual(Math.max(1, level + 1));
  });

  it("better engines make the trip burn less fuel, and the board shows it", () => {
    const job = JOBS.find((j) => !checkJob(at(j), j) && fuelCost(j.totalDistance) >= 10)!;
    const good = withLevels(at(job), "cargo-hauler", { engines: 5 });
    const started = acceptJob(good, job, 0);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state.fuel).toBe(good.fuel - tripFuelCost(good, job.totalDistance));
    expect(tripFuelCost(good, job.totalDistance)).toBeLessThan(fuelCost(job.totalDistance));
    const g = newGame();
    g.state = { ...good, currentDockId: job.originDockId };
    const entry = g.getBoard().find((e) => e.job.id === job.id);
    if (entry) expect(entry.fuelNeeded).toBe(tripFuelCost(g.state, job.totalDistance));
  });

  it("refuel and emergency refuel fill up to the BIGGER tank", () => {
    const s = withLevels({ ...newGameState(docks[0]!.id), credits: 1000, fuel: 0 }, "cargo-hauler", { tank: 5 });
    const r = refuel(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.fuel).toBe(90);
    // stuck + emergency refuel never goes above the bigger tank
    const stuck = withLevels({ ...newGameState(docks[0]!.id), credits: 0, fuel: 0 }, "cargo-hauler", { tank: 5 });
    const jobs = JOBS.filter((j) => j.originDockId === docks[0]!.id);
    if (isStuck(stuck, jobs)) {
      const e = emergencyRefuel(stuck, jobs);
      expect(e.ok).toBe(true);
      if (e.ok) expect(e.state.fuel).toBeLessThanOrEqual(90);
    }
  });

  it("passenger comfort adds pay on passenger and tour jobs only, added to the other bonuses", () => {
    const pass = JOBS.find((j) => j.kind === "PASSENGER")!;
    const trade = JOBS.find((j) => j.kind === "TRADE")!;
    const base = { ...newGameState(pass.originDockId), completedJobs: TOP };
    const comfy = withLevels(base, "cargo-hauler", { comfort: 5 });
    const rank = withBonuses(base, pass).bonusPercent;
    expect(withBonuses(comfy, pass).bonusPercent).toBe(rank + 30);
    expect(withBonuses(comfy, pass).job.reward).toBe(Math.round(pass.reward * (1 + (rank + 30) / 100)));
    expect(withBonuses(comfy, pass).baseReward).toBe(pass.reward);
    expect(withBonuses(comfy, trade).bonusPercent).toBe(withBonuses(base, trade).bonusPercent);
  });

  it("is paid on arrival, and the plain reward still decides what you may accept (6b rule)", () => {
    const pass = JOBS.find((j) => j.kind === "PASSENGER" && j.amount <= 12 && fuelCost(j.totalDistance) <= 100)!;
    const comfy = withLevels({ ...newGameState(pass.originDockId), completedJobs: TOP, shipId: "passenger-liner", fuel: 100, credits: 0 }, "passenger-liner", { comfort: 5 });
    expect(checkJob(comfy, pass)).toBeNull();
    const paid = withBonuses(comfy, pass).job;
    const started = acceptJob(comfy, paid, 0);
    if (!started.ok) throw new Error(started.block.text);
    const done = settleArrival(started.state, 10 * 3_600_000, () => "x");
    expect(done.state.credits).toBe(paid.reward);
    expect(paid.reward).toBeGreaterThan(pass.reward);
  });
});

describe("upgrades: saving and old saves", () => {
  it("an old save without upgrades loads at level 0 everywhere", () => {
    const s = normalizeState({ currentDockId: docks[0]!.id, credits: 50, shipId: "scout", ownedShips: {} });
    expect(s.shipUpgrades).toEqual({});
    expect(upgradeLevels(s)).toEqual({ tank: 0, hold: 0, engines: 0, comfort: 0 });
    expect(shipStats(s).fuelTankSize).toBe(110);
  });

  it("repairs bad levels, drops unknown and unowned ships", () => {
    const s = normalizeState({
      currentDockId: docks[0]!.id,
      shipUpgrades: {
        "cargo-hauler": { tank: 9, hold: -2, engines: 2.7, comfort: "x" },
        scout: { tank: 3 }, // not owned
        nope: { tank: 1 },
      },
    } as unknown as Partial<GameState> & { currentDockId: string });
    expect(s.shipUpgrades["cargo-hauler"]).toEqual({ tank: 5, hold: 0, engines: 2, comfort: 0 });
    expect(s.shipUpgrades["scout"]).toBeUndefined();
    expect(s.shipUpgrades["nope"]).toBeUndefined();
  });

  it("keeps fuel inside the real tank (bigger with upgrades, never above it)", () => {
    const upgraded = normalizeState({
      currentDockId: docks[0]!.id,
      fuel: 80,
      shipUpgrades: { "cargo-hauler": { tank: 5, hold: 0, engines: 0, comfort: 0 } },
    });
    expect(upgraded.fuel).toBe(80); // 80 fits the upgraded tank of 90
    const plain = normalizeState({ currentDockId: docks[0]!.id, fuel: 80 });
    expect(plain.fuel).toBe(60);
  });

  it("survives a JSON round trip through loadState", () => {
    const g = richGame();
    g.buyUpgrade("scout", "tank");
    g.buyUpgrade("cargo-hauler", "comfort");
    const copy = newGame();
    copy.loadState(JSON.parse(JSON.stringify(g.state)));
    expect(copy.state).toEqual(g.state);
  });

  it("clamps fuel when a ship's tank is smaller than its stored fuel", () => {
    const s = normalizeState({ currentDockId: docks[0]!.id, shipId: "cargo-hauler", ownedShips: { scout: { fuel: 500 } } });
    expect(s.ownedShips["scout"]?.fuel).toBe(110);
    const switched = switchShip({ ...s, ownedShips: { scout: { fuel: 110 } } }, "scout");
    expect(switched.ok).toBe(true);
  });
});

describe("upgrades: determinism", () => {
  it("the same buys give the same state and the same funny line", () => {
    const run = (): { state: GameState; line: string } => {
      const g = richGame();
      g.buyUpgrade("cargo-hauler", "tank");
      const r = g.buyUpgrade("scout", "comfort");
      return { state: g.state, line: r.ok ? r.line : "" };
    };
    expect(run()).toEqual(run());
  });

  it("offers do not change the state", () => {
    const g = richGame();
    const before = JSON.stringify(g.state);
    g.getUpgradeOffers();
    g.getUpgradeOffers("scout");
    g.getShipStats();
    expect(JSON.stringify(g.state)).toBe(before);
    expect(upgradeOffers(g.state)).toEqual(g.getUpgradeOffers());
  });
});
