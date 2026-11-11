// Stage 4g (Agent 4): paint jobs (liveries) in the game rules and the save. Cosmetic only.
import { describe, expect, it } from "vitest";
import {
  Game,
  LIVERY_IDS,
  LIVERY_PRICE,
  SHIP_ORDER,
  STANDARD_LIVERY,
  cleanShipLivery,
  createClock,
  newGameState,
  normalizeState,
  shipStats,
  type GameState,
} from "../src/game";
import { fitToUniverse, loadIntoGame, makeSaveData, migrateSave, readSave, type SaveData } from "../src/save";
import { DEFAULT_LIVERY, LIVERIES, liveriesFor } from "../src/render/assets/liveries";
import { docksOf, getPlanetsOfSystem, getSystem, listSystemsNear, startDockOf } from "../src/universe";

const SEED = 12345;

function makeGame(startDockId: string = startDockOf(SEED).id) {
  let t = 1_000_000_000;
  const game = new Game(SEED, startDockId, createClock(1, () => t));
  return { game, advance: (ms: number) => void (t += ms), now: () => t };
}

/** A game with money (the plain state is data, so a test may set it) and a Scout in the hangar. */
function richGame() {
  const g = makeGame();
  g.game.state = { ...g.game.state, credits: 10_000, ownedShips: { scout: { fuel: 50 } } };
  return g;
}

describe("the game's list of paint job ids matches the render list", () => {
  it("has the same ships and the same ids in the same order (standard first)", () => {
    expect(Object.keys(LIVERY_IDS).sort()).toEqual([...SHIP_ORDER].sort());
    expect(Object.keys(LIVERIES).sort()).toEqual(Object.keys(LIVERY_IDS).sort());
    for (const shipId of SHIP_ORDER) {
      expect(LIVERY_IDS[shipId]).toEqual(liveriesFor(shipId).map((l) => l.id));
      expect(LIVERY_IDS[shipId]?.[0]).toBe(STANDARD_LIVERY);
      expect(LIVERY_IDS[shipId]?.length).toBe(4);
    }
    expect(STANDARD_LIVERY).toBe(DEFAULT_LIVERY);
  });
});

describe("a new game", () => {
  it("owns and wears the standard paint on its ship; the other paint jobs cost the price", () => {
    const { game } = makeGame();
    expect(game.state.shipLiveries).toEqual({});
    expect(game.currentLivery("cargo-hauler")).toBe("standard");
    const rows = game.getLiveryCatalog("cargo-hauler");
    expect(rows.map((r) => r.id)).toEqual(["standard", "hazard-yellow", "teal-line", "orange-express"]);
    expect(rows[0]).toMatchObject({ owned: true, worn: true, price: 0, canBuy: false, canWear: false });
    for (const row of rows.slice(1)) {
      expect(row).toMatchObject({ owned: false, worn: false, price: LIVERY_PRICE, canBuy: false, canWear: false });
      expect(row.reason).toBe(`Costs ${LIVERY_PRICE} credits, you have 200.`);
    }
    expect(LIVERY_PRICE).toBe(500);
  });

  it("an unknown ship has no paint jobs, and a ship you do not own has none to wear", () => {
    const { game } = makeGame();
    expect(game.getLiveryCatalog("nope")).toEqual([]);
    const scoutRows = game.getLiveryCatalog("scout");
    expect(scoutRows.length).toBe(4);
    expect(scoutRows.every((r) => !r.owned && !r.worn && !r.canBuy && !r.canWear)).toBe(true);
    expect(scoutRows[1]?.reason).toBe("You do not own this ship.");
  });
});

describe("buying and wearing", () => {
  it("buying costs the price, adds the paint job, and does not put it on", () => {
    const { game } = richGame();
    const r = game.buyLivery("cargo-hauler", "hazard-yellow");
    expect(r).toEqual({ ok: true, price: 500 });
    expect(game.state.credits).toBe(9_500);
    expect(game.currentLivery("cargo-hauler")).toBe("standard");
    const row = game.getLiveryCatalog("cargo-hauler").find((x) => x.id === "hazard-yellow");
    expect(row).toMatchObject({ owned: true, worn: false, price: 0, canBuy: false, canWear: true, reason: "You already own this paint job." });
  });

  it("wearing is free, and standard is always available", () => {
    const { game } = richGame();
    game.buyLivery("cargo-hauler", "teal-line");
    const credits = game.state.credits;
    expect(game.setLivery("cargo-hauler", "teal-line")).toEqual({ ok: true });
    expect(game.currentLivery("cargo-hauler")).toBe("teal-line");
    expect(game.state.credits).toBe(credits);
    expect(game.getLiveryCatalog("cargo-hauler").find((x) => x.worn)?.id).toBe("teal-line");
    expect(game.setLivery("cargo-hauler", "standard")).toEqual({ ok: true });
    expect(game.currentLivery("cargo-hauler")).toBe("standard");
    expect(game.setLivery("cargo-hauler", "teal-line")).toEqual({ ok: true }); // still owned: free again
    expect(game.state.credits).toBe(credits);
  });

  it("cannot be bought twice, and the second try costs nothing", () => {
    const { game } = richGame();
    expect(game.buyLivery("cargo-hauler", "orange-express").ok).toBe(true);
    const credits = game.state.credits;
    expect(game.buyLivery("cargo-hauler", "orange-express")).toEqual({ ok: false, reason: "You already own this paint job." });
    expect(game.state.credits).toBe(credits);
  });

  it("cannot be bought without the money, with the numbers in the text", () => {
    const { game } = makeGame();
    expect(game.buyLivery("cargo-hauler", "hazard-yellow")).toEqual({ ok: false, reason: "Costs 500 credits, you have 200." });
    game.state = { ...game.state, credits: 499 };
    expect(game.buyLivery("cargo-hauler", "hazard-yellow").ok).toBe(false);
    game.state = { ...game.state, credits: 500 };
    expect(game.buyLivery("cargo-hauler", "hazard-yellow").ok).toBe(true);
    expect(game.state.credits).toBe(0);
  });

  it("the standard paint cannot be bought, and unknown ships and paint jobs are refused in plain text", () => {
    const { game } = richGame();
    expect(game.buyLivery("cargo-hauler", "standard")).toEqual({ ok: false, reason: "The standard paint is free and always yours." });
    expect(game.buyLivery("nope", "standard")).toEqual({ ok: false, reason: "There is no such ship." });
    expect(game.buyLivery("cargo-hauler", "rescue-red")).toEqual({ ok: false, reason: "There is no such paint job." }); // that one is the Scout's
    expect(game.setLivery("cargo-hauler", "rescue-red")).toEqual({ ok: false, reason: "There is no such paint job." });
    expect(game.setLivery("nope", "standard")).toEqual({ ok: false, reason: "There is no such ship." });
    expect(game.state.credits).toBe(10_000);
  });

  it("cannot be worn before it is bought, and wearing the paint you wear is refused", () => {
    const { game } = richGame();
    const r = game.setLivery("cargo-hauler", "hazard-yellow");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("500 credits");
    expect(game.setLivery("cargo-hauler", "standard")).toEqual({ ok: false, reason: "The ship already wears this paint." });
  });

  it("changes nothing about how the ship plays", () => {
    const { game } = richGame();
    const before = shipStats(game.state);
    game.buyLivery("cargo-hauler", "hazard-yellow");
    game.setLivery("cargo-hauler", "hazard-yellow");
    expect(shipStats(game.state)).toEqual(before);
    expect(game.getBoard().map((e) => e.job.reward)).toEqual(makeGame().game.getBoard().map((e) => e.job.reward));
  });
});

describe("where you can buy", () => {
  it("only at a dock: floating at a planet without a dock refuses with the planet's name, wearing still works", () => {
    const g = richGame();
    const { game, advance } = g;
    game.buyLivery("cargo-hauler", "teal-line");
    let scenery: { id: string; name: string } | undefined;
    for (const system of listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 40)) {
      const docks = new Set(docksOf(SEED, system).map((d) => d.id));
      const planet = getPlanetsOfSystem(SEED, system.id).find((p) => !docks.has(p.id));
      if (planet) {
        game.state = { ...game.state, currentDockId: (docksOf(SEED, system)[0] as { id: string }).id };
        scenery = planet;
        break;
      }
    }
    if (!scenery) throw new Error("no scenery planet near the start");
    expect(game.freeTravel(scenery.id).ok).toBe(true);
    advance(20_000);
    game.update();
    expect(game.state.spacePlanetId).toBe(scenery.id);
    const credits = game.state.credits; // after the trip (it may pay a discovery bonus)
    const buy = game.buyLivery("cargo-hauler", "hazard-yellow");
    expect(buy.ok).toBe(false);
    if (!buy.ok) expect(buy.reason).toContain(scenery.name);
    expect(game.state.credits).toBe(credits);
    const row = game.getLiveryCatalog("cargo-hauler").find((x) => x.id === "orange-express");
    expect(row?.canBuy).toBe(false);
    expect(row?.reason).toContain(scenery.name);
    expect(game.setLivery("cargo-hauler", "teal-line")).toEqual({ ok: true }); // paint you own can be put on
    expect(getSystem(SEED, scenery.id.split("/")[0] as string)).not.toBeNull();
  });

  it("not during a flight (buying and wearing)", () => {
    const { game } = richGame();
    game.buyLivery("cargo-hauler", "teal-line");
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) return;
    expect(game.accept(entry.job.id).ok).toBe(true);
    expect(game.buyLivery("cargo-hauler", "hazard-yellow")).toEqual({ ok: false, reason: "You cannot buy paint during a flight." });
    expect(game.setLivery("cargo-hauler", "teal-line")).toEqual({ ok: false, reason: "You cannot change paint during a flight." });
  });

  it("at any dock, not only the start dock", () => {
    const { game } = richGame();
    const other = listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 20).map((s) => docksOf(SEED, s)[0]).find((d) => d && d.id !== game.state.currentDockId);
    if (!other) throw new Error("no other dock");
    game.state = { ...game.state, currentDockId: other.id };
    expect(game.buyLivery("cargo-hauler", "hazard-yellow").ok).toBe(true);
  });
});

describe("several ships", () => {
  it("each ship keeps its own paint, and you can buy for a ship that is not the active one", () => {
    const { game } = richGame();
    expect(game.buyLivery("scout", "rescue-red")).toEqual({ ok: true, price: 500 }); // the Hauler is active
    expect(game.setLivery("scout", "rescue-red")).toEqual({ ok: true });
    game.buyLivery("cargo-hauler", "hazard-yellow");
    game.setLivery("cargo-hauler", "hazard-yellow");
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(game.switchShip("scout").ok).toBe(true);
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(game.currentLivery("cargo-hauler")).toBe("hazard-yellow");
    expect(game.switchShip("cargo-hauler").ok).toBe(true);
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(game.currentLivery("cargo-hauler")).toBe("hazard-yellow");
    // a paint job of one ship is not the other's
    expect(game.getLiveryCatalog("scout").find((x) => x.id === "hazard-yellow")).toBeUndefined();
  });

  it("a newly bought ship starts with the standard paint", () => {
    const { game } = makeGame();
    game.state = { ...game.state, credits: 5_000 };
    expect(game.buyShip("passenger-liner").ok).toBe(true);
    expect(game.currentLivery("passenger-liner")).toBe("standard");
    const rows = game.getLiveryCatalog("passenger-liner");
    expect(rows[0]).toMatchObject({ owned: true, worn: true });
    expect(rows.slice(1).every((r) => !r.owned && r.price === 500 && r.canBuy)).toBe(true);
  });

  it("a ship you do not own cannot get paint", () => {
    const { game } = richGame();
    expect(game.buyLivery("passenger-liner", "sky-blue")).toEqual({ ok: false, reason: "You do not own this ship." });
    expect(game.setLivery("passenger-liner", "standard")).toEqual({ ok: false, reason: "You do not own this ship." });
    expect(game.state.credits).toBe(10_000);
  });
});

describe("repairing saved data", () => {
  const base = (): GameState => ({ ...newGameState(startDockOf(SEED).id), ownedShips: { scout: { fuel: 40 } } });

  it("unknown ids, repeats, a worn paint that is not owned, and wrong types are repaired", () => {
    expect(cleanShipLivery("scout", { owned: ["rescue-red", "x", "rescue-red", 5, "hazard-yellow"], worn: "rescue-red" })).toEqual({ owned: ["standard", "rescue-red"], worn: "rescue-red" });
    expect(cleanShipLivery("scout", { owned: ["rescue-red"], worn: "electric-blue" })).toEqual({ owned: ["standard", "rescue-red"], worn: "standard" });
    expect(cleanShipLivery("scout", { owned: "nope", worn: 7 })).toEqual({ owned: ["standard"], worn: "standard" });
    expect(cleanShipLivery("scout", null)).toEqual({ owned: ["standard"], worn: "standard" });
    expect(cleanShipLivery("scout", { owned: [], worn: "standard" })).toEqual({ owned: ["standard"], worn: "standard" });
    expect(cleanShipLivery("nope", { owned: ["a"], worn: "a" })).toEqual({ owned: [], worn: "standard" });
  });

  it("normalizeState keeps good entries, drops default-only entries, other ships' and unknown ships' entries", () => {
    const state = normalizeState({
      ...base(),
      shipLiveries: {
        scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" },
        "cargo-hauler": { owned: ["standard"], worn: "standard" }, // nothing special: not stored
        "passenger-liner": { owned: ["standard", "sky-blue"], worn: "sky-blue" }, // not owned: dropped
        nope: { owned: ["standard"], worn: "standard" },
      },
    });
    expect(state.shipLiveries).toEqual({ scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } });
    for (const bad of [null, 7, "x", [], [1, 2]]) {
      expect(normalizeState({ ...base(), shipLiveries: bad as never }).shipLiveries).toEqual({});
    }
  });

  it("a ship's paint is dropped with the ship (an unowned ship's entry disappears)", () => {
    const state = normalizeState({ ...base(), ownedShips: {}, shipLiveries: { scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } } });
    expect(state.shipLiveries).toEqual({});
  });
});

describe("the save", () => {
  it("owned and worn paint jobs survive a save and a load", () => {
    const a = richGame();
    a.game.buyLivery("scout", "electric-blue");
    a.game.setLivery("scout", "electric-blue");
    a.game.buyLivery("cargo-hauler", "teal-line");
    a.game.buyLivery("cargo-hauler", "orange-express");
    a.game.setLivery("cargo-hauler", "orange-express");
    const save: SaveData = JSON.parse(JSON.stringify(makeSaveData(SEED, a.game.state, a.now(), 1)));
    const b = makeGame();
    loadIntoGame(b.game, save, save.state as GameState, startDockOf(SEED).id, 1);
    expect(b.game.currentLivery("cargo-hauler")).toBe("orange-express");
    expect(b.game.currentLivery("scout")).toBe("electric-blue");
    expect(b.game.getLiveryCatalog("cargo-hauler").filter((r) => r.owned).map((r) => r.id)).toEqual(["standard", "teal-line", "orange-express"]);
    expect(b.game.state.credits).toBe(a.game.state.credits);
  });

  it("a save made BEFORE paint jobs (the field missing) loads through the whole path without crashing", () => {
    // This is what every existing player has in the browser. (The first version of F1 crashed on exactly this kind of save.)
    const start = startDockOf(SEED).id;
    const raw: Record<string, unknown> = { ...newGameState(start), credits: 4321, ownedShips: { scout: { fuel: 30 } } };
    delete raw.shipLiveries;
    const rawState = raw as unknown as GameState;
    expect(() => fitToUniverse(rawState, SEED, start)).not.toThrow();
    const save: SaveData = { version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, universeVersion: 2, state: rawState };
    const { game } = makeGame();
    expect(() => loadIntoGame(game, save, rawState, start, 1)).not.toThrow();
    expect(game.state.credits).toBe(4321);
    expect(game.state.shipLiveries).toEqual({});
    expect(game.currentLivery("cargo-hauler")).toBe("standard");
    expect(game.currentLivery("scout")).toBe("standard");
    expect(game.getLiveryCatalog("scout").length).toBe(4);
    expect(game.getBoard().length).toBe(6);
    // the field with wrong types, through the same path
    for (const bad of [null, 7, "x", [], { scout: 3 }, { scout: { owned: 5, worn: [] } }]) {
      const odd = { ...raw, shipLiveries: bad } as unknown as GameState;
      expect(() => fitToUniverse(odd, SEED, start)).not.toThrow();
      expect(() => makeGame().game.loadState(odd)).not.toThrow();
    }
    // and a Game whose state was set by hand without the field (a test, a debug page) does not crash either
    const hand = makeGame();
    hand.game.state = rawState;
    expect(() => hand.game.getLiveryCatalog("cargo-hauler")).not.toThrow();
    expect(hand.game.currentLivery("cargo-hauler")).toBe("standard");
    // and through the storage reader
    const storage = new Map<string, string>();
    const fake = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) };
    fake.setItem("lazy-freight.save", JSON.stringify(save));
    expect(readSave(fake).kind).toBe("ok");
  });

  it("an old (universe v1) save keeps its paint jobs when it is moved to the new universe", () => {
    const start = startDockOf(SEED).id;
    const state = normalizeState({ ...newGameState(start), credits: 900, ownedShips: { scout: { fuel: 30 } }, shipLiveries: { scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } } });
    const moved = migrateSave({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, state });
    expect(moved.data.state?.shipLiveries).toEqual({ scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } });
    expect(moved.data.state?.credits).toBe(900);
  });
});

describe("how much a paint job costs against income", () => {
  it("is the price in settings (500): the cheapest thing in the game", () => {
    expect(LIVERY_PRICE).toBe(500);
    expect(LIVERY_PRICE).toBeLessThan(1200); // the Scout, the cheapest ship
    expect(LIVERY_PRICE).toBeLessThan(1500); // the first ship upgrade
  });
});
