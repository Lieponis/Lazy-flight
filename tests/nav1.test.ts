// Stage NAV-1 (Agent 4): MY PLACES (start, outposts, recent docks, stars), saved fields, old saves.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Game, MAX_RECENT_DOCKS, MAX_STARRED_PLACES, createClock, newGameState, normalizeState, pushRecentDock, type GameState } from "../src/game";
import { SAVE_KEY, loadIntoGame, makeSaveData, migrateSave, planStart, readSave, type SaveData, type StorageLike } from "../src/save";
import { START_POINT, WORLD_SEED, nearestDocks, startDockOf } from "../src/universe";

const START = startDockOf(WORLD_SEED).id;

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

function makeGame(dockId: string = START) {
  let t = 1_000_000_000;
  const game = new Game(WORLD_SEED, dockId, createClock(1, () => t));
  return { game, advance: (ms: number) => void (t += ms) };
}

/** Fly (free travel) to a dock, wait, arrive. Refuels first. */
function hopTo(h: ReturnType<typeof makeGame>, dockId: string): void {
  h.game.refuel();
  const r = h.game.freeTravel(dockId);
  if (!r.ok) throw new Error(r.reason);
  h.advance((r.seconds + 5) * 1000);
  h.game.update();
  expect(h.game.state.currentDockId).toBe(dockId);
}

/** Docks near the start, in other star systems, that a full-tank Hauler can fly to. */
function reachableDocks(count: number): string[] {
  const { game } = makeGame();
  const out: string[] = [];
  for (const d of game.nearbyDocks(40)) if (d.systemId !== game.currentSystemId() && game.canFreeTravel(d.dockId).ok) out.push(d.dockId);
  return out.slice(0, count);
}

describe("MY PLACES: the automatic entries", () => {
  it("a new game lists the start dock, here, once", () => {
    const { game } = makeGame();
    const rows = game.getPlaces();
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ id: START, dockId: START, isHere: true, distanceLy: 0, reach: "now", starred: false, systemId: 44776692551 });
    expect(rows[0]?.kinds).toEqual(["start", "recent"]);
    expect(rows[0]?.name.length).toBeGreaterThan(3);
    expect(rows[0]?.systemName).toBe("Bimvik Deep JR62R-MT37");
  });

  it("an owned outpost, a star and recent docks appear once each, in the order start, outposts, stars, recent", () => {
    const h = makeGame();
    const docks = reachableDocks(4);
    // pretend to own the first outpost-kind dock we can find; otherwise use a plain star
    const outpost = nearestDocks(WORLD_SEED, START_POINT, 60).find((d) => game0(h).placeName(d.dockId) !== "" && d.dockId !== START && h.game.getOutpostOffer(d.dockId).isOutpost);
    expect(outpost).toBeDefined();
    h.game.state = { ...h.game.state, ownedOutposts: [outpost!.dockId], outpostCount: 1 };
    expect(h.game.starPlace(docks[0]!)).toEqual({ ok: true });
    hopTo(h, docks[1]!);
    hopTo(h, docks[2]!);
    const rows = h.game.getPlaces();
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(START);
    expect(ids[1]).toBe(outpost!.dockId);
    expect(rows.find((r) => r.id === outpost!.dockId)?.kinds).toEqual(["outpost"]);
    expect(rows.find((r) => r.id === docks[0])?.kinds).toEqual(["starred"]);
    // recent, newest first: docks[2] (here), docks[1]
    const recent = rows.filter((r) => r.kinds.includes("recent")).map((r) => r.id);
    expect(recent.slice(0, 2)).toEqual([docks[2], docks[1]]);
    expect(rows.find((r) => r.id === docks[2])?.isHere).toBe(true);
    for (const r of rows) {
      expect(["now", "refuel", "never"]).toContain(r.reach);
      expect(r.reachText.length).toBeGreaterThan(5);
      expect(r.distanceLy).toBeGreaterThanOrEqual(0);
    }
  });

  it("a place that is start AND starred AND recent is one row with all kinds", () => {
    const { game } = makeGame();
    expect(game.starPlace(START)).toEqual({ ok: true });
    const rows = game.getPlaces();
    expect(rows.length).toBe(1);
    expect(rows[0]?.kinds).toEqual(["start", "starred", "recent"]);
  });

  it("distance and reach follow the ship: a far outpost says refuel or never", () => {
    const { game } = makeGame();
    const far = nearestDocks(WORLD_SEED, { x: 49000, y: 0, z: 0 }, 1)[0]!.dockId;
    expect(game.starPlace(far)).toEqual({ ok: true });
    const row = game.getPlaces().find((r) => r.id === far)!;
    expect(row.reach).toBe("never");
    expect(row.distanceLy).toBeGreaterThan(1000);
    expect(row.reachText).toContain("Too far");
  });
});

function game0(h: ReturnType<typeof makeGame>): Game {
  return h.game;
}

describe("stars", () => {
  it("starring twice changes nothing; unstar removes; unknown and old ids are refused with a sentence", () => {
    const { game } = makeGame();
    const [a] = reachableDocks(1);
    expect(game.starPlace(a!)).toEqual({ ok: true });
    expect(game.starPlace(a!)).toEqual({ ok: true });
    expect(game.state.starredPlaces).toEqual([a]);
    expect(game.isStarred(a!)).toBe(true);
    expect(game.unstarPlace(a!)).toEqual({ ok: true });
    expect(game.isStarred(a!)).toBe(false);
    const again = game.unstarPlace(a!);
    expect(again.ok).toBe(false);
    for (const bad of ["3:-2:5:0/2", "", "x", "12/99", "99999999999999"]) {
      const r = game.starPlace(bad);
      expect(r).toEqual({ ok: false, reason: "There is no such place." });
    }
  });

  it("a star system number stars its first dock's place", () => {
    const { game } = makeGame();
    const d = game.nearbyDocks(5).find((x) => x.systemId !== game.currentSystemId())!;
    expect(game.starPlace(String(d.systemId))).toEqual({ ok: true });
    const row = game.getPlaces().find((r) => r.id === String(d.systemId))!;
    expect(row.systemId).toBe(d.systemId);
    expect(row.dockId).not.toBeNull();
    expect(row.kinds).toEqual(["starred"]);
  });

  it("the 31st is refused with full: true and a plain sentence; removing one makes room", () => {
    const { game } = makeGame();
    const ids = game.nearbyDocks(40).map((d) => d.dockId).slice(0, MAX_STARRED_PLACES + 1);
    expect(ids.length).toBe(MAX_STARRED_PLACES + 1);
    for (const id of ids.slice(0, MAX_STARRED_PLACES)) expect(game.starPlace(id)).toEqual({ ok: true });
    expect(game.starPlace(ids[MAX_STARRED_PLACES]!)).toEqual({ ok: false, full: true, reason: "You can star 30 places. Remove one first." });
    expect(game.state.starredPlaces.length).toBe(30);
    expect(game.unstarPlace(ids[0]!)).toEqual({ ok: true });
    expect(game.starPlace(ids[MAX_STARRED_PLACES]!)).toEqual({ ok: true });
  });
});

describe("recent docks", () => {
  it("newest first, no duplicates, at most 10; flying back and forth does not repeat", () => {
    expect(pushRecentDock(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    const many = Array.from({ length: 10 }, (_, i) => `d${i}`);
    expect(pushRecentDock(many, "new")).toEqual(["new", ...many.slice(0, 9)]);
    const h = makeGame();
    const [a, b] = reachableDocks(2);
    hopTo(h, a!);
    hopTo(h, START);
    hopTo(h, a!);
    hopTo(h, b!);
    expect(h.game.state.recentDocks).toEqual([b, a, START]);
    expect(h.game.state.recentDocks.length).toBeLessThanOrEqual(MAX_RECENT_DOCKS);
  });

  it("a job delivery docks too", () => {
    const h = makeGame();
    const entry = h.game.getBoard().find((e) => e.block === null)!;
    expect(h.game.accept(entry.job.id).ok).toBe(true);
    h.advance((entry.tripSeconds + 5) * 1000);
    expect(h.game.update()).not.toBeNull();
    expect(h.game.state.recentDocks[0]).toBe(entry.job.destinationDockId);
  });

  it("nothing is remembered before the first docking", () => {
    const h = makeGame();
    expect(h.game.state.recentDocks).toEqual([]);
  });
});

describe("saving, loading, old saves", () => {
  it("both lists are saved and come back; garbage in the lists is repaired", () => {
    const h = makeGame();
    const [a] = reachableDocks(1);
    h.game.starPlace(a!);
    hopTo(h, a!);
    const data = makeSaveData(WORLD_SEED, h.game.state, 1, 2);
    const copy = JSON.parse(JSON.stringify(data)) as SaveData;
    const g2 = makeGame().game;
    g2.loadState(copy.state as GameState);
    expect(g2.state.recentDocks).toEqual([a]);
    expect(g2.state.starredPlaces).toEqual([a]);
    const bad = normalizeState({ ...newGameState(START), recentDocks: ["x", "x", 5, "", "y"] as unknown as string[], starredPlaces: "no" as unknown as string[] });
    expect(bad.recentDocks).toEqual(["x", "y"]);
    expect(bad.starredPlaces).toEqual([]);
    const huge = normalizeState({ ...newGameState(START), recentDocks: Array.from({ length: 50 }, (_, i) => `d${i}`), starredPlaces: Array.from({ length: 50 }, (_, i) => `s${i}`) });
    expect(huge.recentDocks.length).toBe(10);
    expect(huge.starredPlaces.length).toBe(30);
  });

  it("ids that do not exist in this universe are dropped on load (old-shape ids, other seeds)", () => {
    const g = makeGame().game;
    g.loadState({ ...newGameState(START), recentDocks: ["3:-2:5:0/2", START], starredPlaces: ["3:-2:5:0/2", "12/99", START] });
    expect(g.state.recentDocks).toEqual([START]);
    expect(g.state.starredPlaces).toEqual([START]);
  });

  it("an old save with no lists loads through the whole path with empty lists and a working places list", () => {
    for (const name of ["v2-job-in-flight", "v2-free-trip-explored", "v2-floating", "v1-plain"]) {
      const save = JSON.parse(readFileSync(`tests/fixtures/old-saves/${name}.json`, "utf8")) as SaveData;
      expect((save.state as unknown as Record<string, unknown>).recentDocks).toBeUndefined();
      const storage = new MemoryStorage();
      storage.data.set(SAVE_KEY, JSON.stringify(save));
      const plan = planStart("", storage);
      const dock = startDockOf(plan.seed).id;
      const game = new Game(plan.seed, dock, createClock(1, () => 20_000));
      if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, dock, Date.now());
      expect(game.state.recentDocks).toEqual([]);
      expect(game.state.starredPlaces).toEqual([]);
      const rows = game.getPlaces();
      expect(rows[0]?.id).toBe(dock);
      expect(rows.every((r) => typeof r.name === "string" && r.name !== "")).toBe(true);
      // second load: nothing is lost or added
      const again = readSave(storage);
      expect(again.kind).toBe("ok");
    }
  });

  it("a save that is moved (other seed) forgets its recent docks and stars, which belong to another universe", () => {
    const state = { ...newGameState("1:1:1:0/1"), recentDocks: ["1:1:1:0/1"], starredPlaces: ["1:1:1:0/1"] };
    const data = makeSaveData(777, state, 1, 2);
    const moved = migrateSave(data, WORLD_SEED);
    expect(moved.message).not.toBeNull();
    expect(moved.data.state?.recentDocks).toEqual([]);
    expect(moved.data.state?.starredPlaces).toEqual([]);
  });

  it("a current save written by this version keeps the lists through planStart", () => {
    const h = makeGame();
    const [a] = reachableDocks(1);
    h.game.starPlace(a!);
    const storage = new MemoryStorage();
    storage.data.set(SAVE_KEY, JSON.stringify(makeSaveData(WORLD_SEED, h.game.state, 1, 2)));
    const plan = planStart("", storage);
    expect(plan.state?.starredPlaces).toEqual([a]);
  });
});
