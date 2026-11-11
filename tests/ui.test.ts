import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  Game,
  createClock,
  refuel,
  newGameState,
  rankInfos,
  shipCatalog,
  buyUpgrade,
  upgradeOffers,
  tripFuelCost,
  fuelCost,
  type BoardEntry,
  type GameState,
  type OutpostOffer,
} from "../src/game";
import { getJobBoard, getPlanetsOfSystem, listSystemsNear, type Job } from "../src/universe";
import {
  blockedReason,
  formatCredits,
  formatDistance,
  formatFuel,
  formatTripTime,
  fuelFraction,
  fuelIsLow,
  jobCardText,
  kindLabel,
  locationText,
  emergencyVisible,
  overlayAllowed,
  refuelButton,
  neededRankText,
  outpostPanelText,
  ownedOutpostLine,
  perksText,
  rankRowText,
  rankUpLine,
  shipCardText,
  shortOutpostReason,
  shortShipReason,
  shortUpgradeReason,
  upgradeRowText,
  upgradeSummary,
  upgradeTracksFor,
  flyHereText,
  freeArrivalNote,
  explorerRankUpLine,
  explorerRowText,
  whatNowChoices,
  noJobsHint,
  paintRowText,
  paintSummary,
  planetPanelText,
  sceneryLine,
  startNotice,
  EMPTY_BOARD_TEXT,
  PLANET_PANEL_HINT,
  sortForDisplay,
  visibleControls,
} from "../src/ui/logic";

const names = {
  dockName: (id: string) => `Dock ${id}`,
  systemNameOfDock: () => "Sol",
};

function fakeJob(over: Partial<Job> = {}): Job {
  return {
    id: "a/1#1#1",
    kind: "TRADE",
    loadType: "GOODS",
    item: "tofu",
    itemName: "Frozen Tofu",
    amount: 12,
    requiredHold: "CARGO_BAY",
    originDockId: "a/1",
    destinationDockId: "b/2",
    stops: ["b/2"],
    totalDistance: 4.26,
    timeLimitSlots: null,
    reward: 1350,
    blurb: "Keep it cold.",
    unitPriceAtDestination: 100,
    special: null,
    ...over,
  };
}

describe("ui: numbers", () => {
  it("formats credits with thousands commas", () => {
    expect(formatCredits(0)).toBe("0 CR");
    expect(formatCredits(1250)).toBe("1,250 CR");
    expect(formatCredits(1234567)).toBe("1,234,567 CR");
    expect(formatCredits(-40)).toBe("-40 CR");
    expect(formatCredits(Number.NaN)).toBe("0 CR");
  });

  it("formats fuel and the bar", () => {
    expect(formatFuel(42, 60)).toBe("42/60");
    expect(fuelFraction(30, 60)).toBe(0.5);
    expect(fuelFraction(90, 60)).toBe(1);
    expect(fuelFraction(5, 0)).toBe(0);
    expect(fuelIsLow(15, 60)).toBe(true);
    expect(fuelIsLow(16, 60)).toBe(false);
  });

  it("formats distance", () => {
    expect(formatDistance(4.26)).toBe("4.3 LY");
    expect(formatDistance(0)).toBe("IN SYSTEM");
  });

  it("shows the real wait, using the game's formatting", () => {
    expect(formatTripTime(200, 1)).toBe("3m 20s");
    expect(formatTripTime(7200, 60)).toBe("2m 00s");
    expect(formatTripTime(30, 0)).toBe("30s"); // bad speed falls back to 1
  });
});

describe("ui: words", () => {
  it("labels job kinds", () => {
    expect(kindLabel("TRADE")).toBe("CARGO");
    expect(kindLabel("PASSENGER")).toBe("PASSENGERS");
    expect(kindLabel("TOUR")).toBe("TOUR");
  });

  it("gives a short plain reason for every block", () => {
    expect(blockedReason("no-cabin")).toBe("Needs a passenger cabin");
    expect(blockedReason("cargo-too-large")).toBe("Cargo too large");
    expect(blockedReason("not-enough-fuel")).toBe("Not enough fuel");
    expect(blockedReason("tank-too-small")).toBe("Too far for this tank");
    expect(blockedReason("something-new")).toBe("Not available");
  });

  it("shows the location, or where you are going while flying", () => {
    expect(locationText({ flying: false, dockName: "Rusty Pad", systemName: "Sol" })).toBe("Rusty Pad · Sol");
    expect(locationText({ flying: true, dockName: "Rusty Pad", systemName: "Sol" })).toBe("EN ROUTE TO Rusty Pad · Sol");
  });
});

describe("ui: job cards", () => {
  it("builds the text of a takeable card", () => {
    const entry: BoardEntry = { job: fakeJob(), baseReward: 1350, bonusPercent: 0, fuelNeeded: 9, tripSeconds: 200, block: null };
    const c = jobCardText(entry, names, 1);
    expect(c).toMatchObject({
      kind: "CARGO",
      title: "12 × Frozen Tofu",
      destination: "Dock b/2 · Sol",
      distance: "4.3 LY",
      reward: "+1,350 CR",
      time: "3m 20s",
      fuel: "9 FUEL",
      blurb: "Keep it cold.",
      takeable: true,
      reason: "",
    });
  });

  it("dims a blocked card with a plain reason and the game's detail", () => {
    const entry: BoardEntry = {
      job: fakeJob({ kind: "TOUR", stops: ["x/1", "y/1", "b/2"] }),
      baseReward: 1350,
      bonusPercent: 0,
      fuelNeeded: 9,
      tripSeconds: 200,
      block: { code: "no-cabin", text: "Needs a passenger cabin (your ship has none)." },
    };
    const c = jobCardText(entry, names, 1);
    expect(c.takeable).toBe(false);
    expect(c.reason).toBe("Needs a passenger cabin");
    expect(c.reasonDetail).toContain("your ship has none");
    expect(c.destination).toBe("Dock b/2 · Sol (3 stops)");
  });

  it("puts takeable jobs first and keeps the order inside each group", () => {
    const list = [
      { id: 1, takeable: false },
      { id: 2, takeable: true },
      { id: 3, takeable: false },
      { id: 4, takeable: true },
    ];
    expect(sortForDisplay(list).map((x) => x.id)).toEqual([2, 4, 1, 3]);
  });

  it("works on a real board from the game (some takeable, some blocked)", () => {
    const sys = listSystemsNear(1337, { x: 0, y: 0, z: 0 }, 30).find((s) => getPlanetsOfSystem(1337, s.id).length > 0);
    expect(sys).toBeDefined();
    const dock = getPlanetsOfSystem(1337, sys!.id)[0]!;
    const game = new Game(1337, dock.id, createClock(1));
    const board = game.getBoard();
    expect(board.length).toBe(getJobBoard(1337, dock.id, game.currentSlot())?.length);
    for (const entry of board) {
      const c = jobCardText(entry, names, 1);
      expect(c.takeable).toBe(entry.block === null);
      if (!c.takeable) expect(c.reason).not.toBe("");
    }
  });
});

describe("ui: refuel button", () => {
  it("shows the cost when fuel can be bought", () => {
    const state = { ...newGameState("a/1"), fuel: 40, credits: 500 };
    const b = refuelButton(refuel(state));
    expect(b.disabled).toBe(false);
    expect(b.text).toBe("REFUEL +20 · 40 CR");
  });

  it("is disabled when the tank is full", () => {
    const b = refuelButton(refuel(newGameState("a/1")));
    expect(b).toMatchObject({ disabled: true, text: "TANK FULL" });
  });

  it("is disabled with a reason when credits are short", () => {
    const state = { ...newGameState("a/1"), fuel: 10, credits: 1 };
    const b = refuelButton(refuel(state));
    expect(b.disabled).toBe(true);
    expect(b.hint).toMatch(/credits/i);
  });
});

describe("ui: which controls show on which screen", () => {
  it("docked, nothing open: JOBS and MAP", () => {
    expect(visibleControls("docked", "none", false)).toEqual({ statusStrip: true, dockButtons: true, mapBar: false, mapTab: null, whatNow: false });
  });

  it("docked with a menu or card open: no JOBS and MAP", () => {
    expect(visibleControls("docked", "jobs", false).dockButtons).toBe(false);
    expect(visibleControls("docked", "arrival", false).dockButtons).toBe(false);
  });

  it("maps: the switch and CLOSE, with the right tab lit", () => {
    expect(visibleControls("system", "none", false)).toMatchObject({ dockButtons: false, mapBar: true, mapTab: "system" });
    expect(visibleControls("starmap", "none", false)).toMatchObject({ dockButtons: false, mapBar: true, mapTab: "galaxy" });
  });

  it("flight: only the status strip", () => {
    expect(visibleControls("flight", "none", true)).toEqual({ statusStrip: true, dockButtons: false, mapBar: false, mapTab: null, whatNow: false });
    // a job in progress hides the buttons even before the flight screen shows
    expect(visibleControls("docked", "none", true).dockButtons).toBe(false);
  });

  it("the shipyard is a docked-only menu like Jobs", () => {
    expect(visibleControls("docked", "shipyard", false).dockButtons).toBe(false);
    expect(overlayAllowed("docked", "shipyard", false)).toBe("shipyard");
    expect(overlayAllowed("system", "shipyard", false)).toBe("none");
    expect(overlayAllowed("flight", "shipyard", true)).toBe("none");
  });

  it("menus only stay open in the docked view", () => {
    expect(overlayAllowed("docked", "jobs", false)).toBe("jobs");
    expect(overlayAllowed("flight", "jobs", true)).toBe("none");
    expect(overlayAllowed("starmap", "arrival", false)).toBe("none");
  });
});

describe("ui: shipyard cards", () => {
  const rich = (): GameState => ({ ...newGameState("a/1"), credits: 3000 });
  const card = (state: GameState, id: string) => shipCardText(shipCatalog(state).find((e) => e.ship.id === id)!, state.credits);

  it("the starter ship is ACTIVE with its fuel", () => {
    const c = card({ ...rich(), fuel: 42 }, "cargo-hauler");
    expect(c).toMatchObject({ name: "Cargo Hauler", action: "active", price: "OWNED", fuel: "FUEL 42/60", reason: "" });
    expect(c.stats).toEqual({ cargo: "30", cabin: "NONE", tank: "60" });
  });

  it("a ship you can afford can be bought", () => {
    const c = card(rich(), "passenger-liner");
    expect(c).toMatchObject({ action: "buy", price: "2,500 CR", fuel: "", reason: "" });
    expect(c.stats).toEqual({ cargo: "6", cabin: "12", tank: "100" });
  });

  it("a ship you cannot afford says how much is missing", () => {
    const c = card({ ...rich(), credits: 200 }, "passenger-liner");
    expect(c.action).toBe("blocked");
    expect(c.reason).toBe("Need 2,300 CR more"); // Liner 2,500 (6b), you have 200
  });

  it("an owned, parked ship can be switched to and shows its own fuel", () => {
    const s: GameState = { ...rich(), ownedShips: { scout: { fuel: 33 } } };
    expect(card(s, "scout")).toMatchObject({ action: "switch", price: "OWNED", fuel: "FUEL 33/110" });
  });

  it("nothing can be bought or switched during a flight", () => {
    const flying = { ...rich(), ownedShips: { scout: { fuel: 33 } }, currentJob: { id: "x" } } as unknown as GameState;
    expect(card(flying, "scout")).toMatchObject({ action: "blocked", reason: "Not during a flight" });
    expect(card(flying, "passenger-liner")).toMatchObject({ action: "blocked", reason: "Not during a flight" });
  });

  it("shortens the game's reasons", () => {
    expect(shortShipReason("Costs 1500 credits, you have 1499.", 1500, 1499)).toBe("Need 1 CR more");
    expect(shortShipReason("You already own this ship.", 0, 0)).toBe("Owned");
    expect(shortShipReason("", 0, 0)).toBe("");
    expect(shortShipReason("Something new.", 0, 0)).toBe("Something new.");
  });
});

describe("ui: emergency fuel button", () => {
  it("shows only when stuck and not on a job", () => {
    expect(emergencyVisible(true, false)).toBe(true);
    expect(emergencyVisible(false, false)).toBe(false);
    expect(emergencyVisible(true, true)).toBe(false);
  });
});

describe("ui 5c: ranks", () => {
  it("rank-too-low has a short reason and names the rank the job needs", () => {
    expect(blockedReason("rank-too-low")).toBe("Rank too low");
    expect(neededRankText({ kind: "TRADE", reward: 1000 })).toBe("Need rank: Crate Wrangler");
    expect(neededRankText({ kind: "TRADE", reward: 5000 })).toBe("Need rank: Freight Baron");
    expect(neededRankText({ kind: "PASSENGER", reward: 1000 })).toBe("Need rank: Seatbelt Sheriff");
    expect(neededRankText({ kind: "SCAN", reward: 5000 })).toBe("");
  });

  it("a card blocked by rank shows the rank it needs (from the plain reward)", () => {
    const entry: BoardEntry = {
      job: fakeJob({ reward: 1100 }),
      baseReward: 1000,
      bonusPercent: 10,
      fuelNeeded: 9,
      tripSeconds: 200,
      block: { code: "rank-too-low", text: "Needs rank Crate Wrangler in cargo (you are Box Pusher)." },
    };
    const c = jobCardText(entry, names, 1);
    expect(c.takeable).toBe(false);
    expect(c.reason).toBe("Need rank: Crate Wrangler");
    expect(c.reasonDetail).toContain("you are Box Pusher");
  });

  it("rank rows: start, middle and top", () => {
    const [cargo] = rankInfos({ TRADE: 0, PASSENGER: 0, TOUR: 0 });
    expect(rankRowText(cargo!)).toMatchObject({
      label: "CARGO",
      rankName: "Box Pusher",
      rankNumber: "RANK 1/3",
      progress: 0,
      next: "4 more jobs to Crate Wrangler",
      bonus: "NO BONUS YET",
      limit: "JOBS UP TO 800 CR",
      done: "0 delivered",
    });
    const mid = rankRowText(rankInfos({ TRADE: 8, PASSENGER: 0, TOUR: 0 })[0]!); // rank 2 at 4, rank 3 at 12
    expect(mid).toMatchObject({ rankNumber: "RANK 2/3", progress: 0.5, next: "4 more jobs to Freight Baron", bonus: "+5% PAY" });
    const one = rankRowText(rankInfos({ TRADE: 3, PASSENGER: 0, TOUR: 0 })[0]!);
    expect(one.next).toBe("1 more job to Crate Wrangler");
    const top = rankRowText(rankInfos({ TRADE: 40, PASSENGER: 0, TOUR: 0 })[0]!);
    expect(top).toMatchObject({ rankNumber: "RANK 3/3", progress: 1, next: "TOP RANK", bonus: "+10% PAY", limit: "ANY JOB" });
  });

  it("rank-up line for the Delivered card", () => {
    expect(rankUpLine(null)).toBe("");
    expect(rankUpLine({ kind: "TOUR", rankNumber: 2, rankName: "Tour Wrangler" })).toBe("RANK UP: Tour Wrangler (tours)");
  });

  it("the ranks screen is a docked-only menu", () => {
    expect(visibleControls("docked", "ranks", false).dockButtons).toBe(false);
    expect(overlayAllowed("docked", "ranks", false)).toBe("ranks");
    expect(overlayAllowed("flight", "ranks", true)).toBe("none");
  });
});

describe("ui 5c: outposts and perks", () => {
  const perks = { fuelDiscountPercent: 20, deliveryBonusPercent: 10 };
  const offer = (over: Partial<OutpostOffer> = {}): OutpostOffer => ({
    dockId: "a/1",
    dockName: "Rusty Pad",
    systemName: "Kopipex",
    isOutpost: true,
    owned: false,
    price: 12400,
    canBuy: true,
    reason: "",
    perks,
    ...over,
  });

  it("perks in plain words", () => {
    expect(perksText(perks, "Kopipex")).toBe("FUEL -20% · PAY +10% on jobs ending in Kopipex");
  });

  it("an outpost for sale", () => {
    expect(outpostPanelText(offer(), 20000)).toMatchObject({ show: true, owned: false, title: "OUTPOST FOR SALE", price: "12,400 CR", canBuy: true, reason: "" });
  });

  it("an outpost you cannot afford says how much is missing", () => {
    const t = outpostPanelText(offer({ canBuy: false, reason: "Costs 12400 credits, you have 400." }), 400);
    expect(t).toMatchObject({ canBuy: false, reason: "Need 12,000 CR more" });
  });

  it("an owned outpost shows YOUR OUTPOST and the perks", () => {
    const t = outpostPanelText(offer({ owned: true, canBuy: false, reason: "You already own this outpost." }), 0);
    expect(t).toMatchObject({ show: true, owned: true, title: "YOUR OUTPOST", price: "" });
    expect(t.perks).toContain("Kopipex");
  });

  it("stations show no panel", () => {
    expect(outpostPanelText(offer({ isOutpost: false, price: null, canBuy: false, reason: "Stations are not for sale. Only outposts are." }), 0).show).toBe(false);
  });

  it("shortens the game's outpost reasons", () => {
    expect(shortOutpostReason("You cannot buy an outpost during a flight.", 1, 0)).toBe("Not during a flight");
    expect(shortOutpostReason("You can only buy an outpost where you are docked.", 1, 0)).toBe("Dock here to buy it");
    expect(shortOutpostReason("Something new.", 1, 0)).toBe("Something new.");
  });

  it("owned outposts list line", () => {
    expect(ownedOutpostLine({ dockId: "a/1", dockName: "Rusty Pad", systemId: "a", systemName: "Kopipex" })).toBe("Rusty Pad · Kopipex");
  });

  it("job cards ending at your outpost's system get a +10% marker", () => {
    const entry: BoardEntry = { job: fakeJob(), baseReward: 1350, bonusPercent: 10, fuelNeeded: 9, tripSeconds: 200, block: null };
    expect(jobCardText(entry, names, 1, 10).outpostBonus).toBe("+10%");
    expect(jobCardText(entry, names, 1).outpostBonus).toBe("");
  });

  it("the Refuel button shows the discount", () => {
    const state = { ...newGameState("a/1"), fuel: 40, credits: 500 };
    expect(refuelButton(refuel(state), 20).text).toBe("REFUEL +20 · 40 CR (-20%)");
    expect(refuelButton(refuel(state)).text).toBe("REFUEL +20 · 40 CR");
  });
});

describe("ui 5d: upgrades and real numbers", () => {
  const rich = (): GameState => ({ ...newGameState("a/1"), credits: 100000 });
  const buy = (state: GameState, track: string, times = 1): GameState => {
    let s = state;
    for (let i = 0; i < times; i++) {
      const r = buyUpgrade(s, s.shipId, track);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    return s;
  };
  const hauler = (state: GameState) => shipCatalog(state).find((e) => e.ship.id === "cargo-hauler")!;

  it("ship cards show the REAL numbers with upgrades, not the base ones", () => {
    const base = shipCardText(hauler(rich()), 100000);
    expect(base.stats).toEqual({ cargo: "30", cabin: "NONE", tank: "60" });
    const s = buy(buy(rich(), "tank", 2), "hold", 1);
    const c = shipCardText(hauler({ ...s, fuel: 50 }), s.credits);
    expect(c.stats.tank).toBe("72"); // 60 + 2 x 10%
    expect(c.stats.cargo).toBe("33"); // 30 + 10%
    expect(c.fuel).toBe("FUEL 50/72");
    expect(c.upgradable).toBe(true);
    expect(c.upgradeLevels).toBe("3/15"); // the Hauler has no cabin: no comfort track
  });

  it("ships you do not own have no upgrades button", () => {
    const liner = shipCatalog(rich()).find((e) => e.ship.id === "passenger-liner")!;
    expect(shipCardText(liner, 100000)).toMatchObject({ upgradable: false, upgradeLevels: "" });
  });

  it("an upgrade row you can buy", () => {
    const tank = upgradeOffers(rich(), "cargo-hauler").find((o) => o.track === "tank")!;
    const t = upgradeRowText(tank, 100000);
    expect(t).toMatchObject({ name: "FUEL TANK", level: "LEVEL 0/5", progress: 0, button: "BUY LEVEL 1 · 1,500 CR", canBuy: true, maxed: false, reason: "" });
    expect(t.effect).toBe("Next: Tank 60 -> 66 fuel");
  });

  it("a row you cannot afford says how much is missing", () => {
    const poor = { ...rich(), credits: 100 };
    const t = upgradeRowText(upgradeOffers(poor, "cargo-hauler")[0]!, 100);
    expect(t).toMatchObject({ canBuy: false, reason: "Need 1,400 CR more" });
  });

  it("a full track shows MAX, a full bar and no reason", () => {
    const s = buy(rich(), "engines", 5);
    const t = upgradeRowText(upgradeOffers(s, "cargo-hauler").find((o) => o.track === "engines")!, s.credits);
    expect(t).toMatchObject({ level: "LEVEL 5/5", progress: 1, button: "MAX", canBuy: false, maxed: true, reason: "" });
    expect(t.effect).not.toMatch(/^Next/);
  });

  it("shortens the game's upgrade reasons", () => {
    expect(shortUpgradeReason("Costs 4000 credits, you have 10.", 4000, 10)).toBe("Need 3,990 CR more");
    expect(shortUpgradeReason("You cannot buy an upgrade during a flight.", 1, 0)).toBe("Not during a flight");
    expect(shortUpgradeReason("This upgrade is already at the highest level.", null, 0)).toBe("Max level");
    expect(shortUpgradeReason("You do not own this ship.", 1, 0)).toBe("Buy the ship first");
    expect(shortUpgradeReason("", 1, 0)).toBe("");
  });

  it("upgrade summary counts the tracks the ship can use", () => {
    expect(upgradeSummary({ tank: 0, hold: 0, engines: 0, comfort: 0 })).toBe("0/20");
    expect(upgradeSummary({ tank: 5, hold: 2, engines: 1, comfort: 0 })).toBe("8/20");
    expect(upgradeSummary({ tank: 5, hold: 2, engines: 1, comfort: 3 }, 5, 0)).toBe("8/15"); // no cabin: comfort not counted
  });

  it("no Passenger Comfort for a ship without a cabin (Andy)", () => {
    expect(upgradeTracksFor(0)).toEqual(["tank", "hold", "engines"]);
    expect(upgradeTracksFor(12)).toEqual(["tank", "hold", "engines", "comfort"]);
    const liner = shipCatalog({ ...rich(), ownedShips: { "passenger-liner": { fuel: 50 } } }).find((e) => e.ship.id === "passenger-liner")!;
    expect(shipCardText(liner, 0).upgradeLevels).toBe("0/20");
  });

  it("efficient engines lower the fuel a trip burns (the number the cockpit and cards use)", () => {
    const s = buy(rich(), "engines", 5);
    expect(tripFuelCost(s, 20)).toBeLessThan(fuelCost(20));
    expect(tripFuelCost(rich(), 20)).toBe(fuelCost(20));
  });
});

describe("ui 5e: planet panel and wording for fewer docks", () => {
  const base = { planetId: "1:2:3:0/2", planetName: "Zorpex II", typeLabel: "Rocky world", radius: 1.23, here: false, owned: false };

  it("a planet without a dock is SCENERY with a funny line", () => {
    const t = planetPanelText({ ...base, dock: null });
    expect(t).toMatchObject({ tag: "SCENERY", isDock: false, title: "Zorpex II", details: "Rocky world · 1.2x Earth", here: "" });
    expect(t.line).toMatch(/dock|scenery|visit/i);
  });

  it("the scenery line is always the same for the same planet", () => {
    expect(sceneryLine("a/1")).toBe(sceneryLine("a/1"));
    const lines = new Set(Array.from({ length: 40 }, (_, i) => sceneryLine(`x/${i}`)));
    expect(lines.size).toBeGreaterThan(1); // different planets get different jokes
  });

  it("a station dock", () => {
    const t = planetPanelText({ ...base, dock: { name: "Rattling Kettle Station", kind: "STATION" } });
    expect(t).toMatchObject({ tag: "DOCK · STATION", isDock: true, title: "Rattling Kettle Station", details: "Zorpex II · Rocky world · 1.2x Earth", line: "Jobs and fuel here." });
  });

  it("an outpost for sale, an owned outpost, and YOU ARE HERE", () => {
    const sale = planetPanelText({ ...base, dock: { name: "Sleepy Mesa Outpost", kind: "OUTPOST" } });
    expect(sale).toMatchObject({ tag: "DOCK · OUTPOST", line: "Jobs and fuel here. This outpost is for sale." });
    const mine = planetPanelText({ ...base, dock: { name: "Sleepy Mesa Outpost", kind: "OUTPOST" }, owned: true, here: true });
    expect(mine).toMatchObject({ line: "Your outpost: cheaper fuel, better pay.", here: "YOU ARE HERE" });
  });

  it("the old 'nothing to visit' wording is gone and the hint is short", () => {
    expect(PLANET_PANEL_HINT.length).toBeLessThan(60);
    expect(planetPanelText({ ...base, dock: null }).line).not.toContain(" - ");
  });

  it("the universe-rebuilt note is friendlier, shows the refund nicely and stays longer", () => {
    const msg = "The universe was rebuilt. Your credits and ships came with you.";
    expect(startNotice(msg, msg)).toEqual({ text: "Universe rebuilt! Your credits and ships came along.", ms: 12000 });
    const withRefund = startNotice(`${msg} Your outposts were sold back for 40000 credits.`, msg);
    expect(withRefund.text).toBe("Universe rebuilt! Your credits and ships came along. Your outposts were sold back for 40,000 CR.");
    expect(startNotice("Saving is off in this browser.", msg)).toEqual({ text: "Saving is off in this browser.", ms: 7000 });
  });

  it("the empty Jobs board message stays calm", () => {
    expect(EMPTY_BOARD_TEXT).toMatch(/No jobs/);
  });
});

describe("ui 5f: free travel, floating, Explorer, paint jobs", () => {
  it("FLY HERE shows fuel, fuel left on arrival, trip time and discovery pay", () => {
    const t = flyHereText(
      { ok: true, targetId: "a/1", targetName: "Cosy Rock", isDock: false, distanceLy: 4, fuelNeeded: 12, fuelLeft: 38, seconds: 240, discoveryCredits: 75, newSystem: true },
      60,
      1,
    );
    expect(t).toEqual({ canFly: true, button: "FLY HERE", facts: "Fuel 12 · left 38/60 · 4m 00s", discovery: "NEW SYSTEM: +75 CR", reason: "" });
  });

  it("FLY HERE without discovery pay, and the game's refusal shown as it is", () => {
    const known = flyHereText({ ok: true, targetId: "a/1", targetName: "X", isDock: true, distanceLy: 0, fuelNeeded: 1, fuelLeft: 59, seconds: 20, discoveryCredits: 0, newSystem: false }, 60, 1);
    expect(known.discovery).toBe("");
    const no = flyHereText({ ok: false, reason: "Not enough fuel to get back to a dock from there." }, 60, 1);
    expect(no).toMatchObject({ canFly: false, reason: "Not enough fuel to get back to a dock from there.", facts: "" });
  });

  it("the free arrival note: line, discovery, new planet, Explorer rank-up", () => {
    const base = { fromId: "a/1", toId: "b/0", isDock: false, line: "Just you and the stars.", discovery: 0, newSystem: false, newPlanet: false, explorerRankUp: null };
    expect(freeArrivalNote(base)).toBe("Just you and the stars.");
    expect(freeArrivalNote({ ...base, discovery: 53, newSystem: true, newPlanet: true })).toBe("Just you and the stars. New system! +53 CR for discovering it.");
    expect(freeArrivalNote({ ...base, newPlanet: true })).toBe("Just you and the stars. A new planet for your logbook.");
    expect(freeArrivalNote({ ...base, explorerRankUp: { rankNumber: 2, rankName: "Cartographer" } })).toContain("EXPLORER RANK UP: Cartographer!");
    expect(explorerRankUpLine(null)).toBe("");
    expect(explorerRankUpLine({ rankName: "Cartographer" })).toBe("EXPLORER RANK UP: Cartographer");
  });

  it("the Explorer row: start, middle and top", () => {
    const e = (d: number, idx: 0 | 1 | 2, next: string | null, toGo: number | null, bonus: number) => ({
      systems: 3, planets: d - 3, discoveries: d, rankIndex: idx, rankNumber: idx + 1, rankName: ["Lost in Space", "Cartographer", "Mr Galaxy-wide"][idx]!,
      nextRankName: next, discoveriesToNext: toGo, discoveryBonusPercent: bonus,
    });
    expect(explorerRowText(e(5, 0, "Cartographer", 45, 0))).toMatchObject({
      label: "EXPLORER", rankName: "Lost in Space", rankNumber: "RANK 1/3", progress: 0.1, next: "45 more discoveries to Cartographer", bonus: "NO BONUS YET", limit: "3 SYSTEMS · 2 PLANETS",
    });
    expect(explorerRowText(e(125, 1, "Mr Galaxy-wide", 75, 10))).toMatchObject({ progress: 0.5, bonus: "+10% DISCOVERY PAY" });
    expect(explorerRowText(e(200, 2, null, null, 20))).toMatchObject({ progress: 1, next: "TOP RANK" });
    expect(explorerRowText(e(49, 0, "Cartographer", 1, 0)).next).toBe("1 more discovery to Cartographer");
  });

  it("WHAT NOW? choices: emergency fuel only when stuck", () => {
    expect(whatNowChoices(false).map((c) => c.id)).toEqual(["fly", "shipyard", "jobs", "menu", "stay"]);
    expect(whatNowChoices(false).every((c) => c.text.length <= 15)).toBe(true); // fits two columns on a sideways phone
    expect(whatNowChoices(true).map((c) => c.id)).toContain("emergency");
  });

  it("floating: WHAT NOW? shows, Jobs cannot open, the Shipyard and MENU can", () => {
    expect(visibleControls("flight", "none", false, true)).toMatchObject({ dockButtons: false, mapBar: false, whatNow: true });
    expect(visibleControls("flight", "none", true, false).whatNow).toBe(false); // flying: no
    expect(visibleControls("flight", "shipyard", false, true).whatNow).toBe(false); // a menu is open
    expect(overlayAllowed("flight", "shipyard", false, true)).toBe("shipyard");
    expect(overlayAllowed("flight", "menu", false, true)).toBe("menu");
    expect(overlayAllowed("flight", "jobs", false, true)).toBe("none");
    expect(overlayAllowed("flight", "whatnow", false, true)).toBe("whatnow");
    expect(overlayAllowed("docked", "whatnow", false, false)).toBe("none");
    expect(overlayAllowed("flight", "shipyard", true, false)).toBe("none");
    // the maps work from floating too
    expect(visibleControls("system", "none", false, true)).toMatchObject({ mapBar: true, whatNow: false });
  });

  it("the status strip says where you float", () => {
    expect(locationText({ flying: false, floating: true, dockName: "Cosy Rock", systemName: "Kopipex" })).toBe("IN SPACE AT Cosy Rock · Kopipex");
  });

  it("a hint on the Jobs menu when nothing can be taken", () => {
    expect(noJobsHint([{ takeable: false }, { takeable: false }])).toMatch(/FLY HERE/);
    expect(noJobsHint([{ takeable: true }])).toBe("");
  });

  it("paint rows: worn, wear, buy, refused", () => {
    const row = { id: "rescue-red", owned: false, worn: false, price: 500, canBuy: true, reason: "", canWear: false };
    const names = { name: "Rescue Red", description: "Loud and proud." };
    expect(paintRowText(row, names)).toMatchObject({ name: "Rescue Red", action: "buy", button: "BUY · 500 CR" });
    expect(paintRowText({ ...row, canBuy: false, reason: "Costs 500 credits, you have 200." }, names)).toMatchObject({ action: "blocked", reason: "Costs 500 credits, you have 200." });
    expect(paintRowText({ ...row, owned: true, canWear: true, price: 0 }, names)).toMatchObject({ action: "wear", button: "WEAR" });
    expect(paintRowText({ ...row, owned: true, worn: true, price: 0 }, names)).toMatchObject({ action: "worn", button: "WORN" });
    expect(paintRowText({ ...row, id: "odd" }, undefined).name).toBe("odd");
    expect(paintSummary([row, { ...row, owned: true }])).toBe("1/2");
  });
});

// The layer rule for the render layer: it shows things, it never imports the game rules or the menus.
describe("layer rule: src/render never imports src/game or src/ui", () => {
  function listTsFiles(dir: string): string[] {
    const found: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) found.push(...listTsFiles(full));
      else if (name.endsWith(".ts")) found.push(full);
    }
    return found;
  }
  it("has no such imports", () => {
    const bad = /from\s+['"](\.\.\/)+(game|ui)(\/[^'"]*)?['"]/;
    expect(listTsFiles("src/render").filter((f) => bad.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
