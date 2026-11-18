// Agent 6h (stage G6): every old save, and Andy's real save from the live game, loads on universe v3 through the
// REAL start path (planStart -> migrate -> Game -> loadIntoGame) and through the save-file import path.
// Prints one line per save (the table in docs/report-agent-6h.md).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Game, createClock, type GameState } from "../src/game";
import { SAVE_KEY, applyImport, exportSaveFile, inspectImport, loadIntoGame, planStart, startAutoSave, type SaveData, type StorageLike } from "../src/save";
import { WORLD_SEED, startDockOf } from "../src/universe";

const DIR = new URL("./fixtures/old-saves/", import.meta.url);
const NOW = Date.UTC(2026, 10, 18, 4, 0, 0);

class Mem implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

/** One page load on a normal address, like src/main.ts + src/ui/index.ts (without the 3D layer). */
function load(storage: StorageLike) {
  const plan = planStart("", storage, WORLD_SEED);
  const start = startDockOf(plan.seed).id;
  const game = new Game(plan.seed, start, createClock(1, () => NOW));
  if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, start, NOW);
  startAutoSave(game, storage, null, () => NOW);
  game.getBoard();
  game.getRanks();
  game.getExplorer();
  return { plan, game };
}

/** All old saves: the fixtures, plus Andy's live save (a LFSAVE1 text in a .txt file) when it is there. */
function oldSaves(): [string, SaveData][] {
  const out: [string, SaveData][] = [];
  for (const f of readdirSync(DIR).sort()) {
    const text = readFileSync(new URL(f, DIR), "utf8").trim();
    const isFile = f.endsWith(".txt") || (f.endsWith(".json") && (JSON.parse(text) as { format?: string }).format === "lazy-flight-save");
    if (f.endsWith(".json") && !isFile) out.push([f, JSON.parse(text) as SaveData]);
    if (isFile) {
      const r = inspectImport(text, null, NOW);
      if (!r.ok) throw new Error(`${f}: ${r.reason}`);
      out.push([f, r.file.save]);
    }
  }
  return out;
}

const keepers = (s: GameState) => ({
  ships: [s.shipId, ...Object.keys(s.ownedShips)].sort(),
  upgrades: s.shipUpgrades,
  paint: s.shipLiveries,
  ranks: s.completedJobs,
});

describe("6h: old saves on universe v3", () => {
  const rows: string[] = [];
  for (const [name, save] of oldSaves()) {
    it(name, () => {
      const old = save.state as GameState;
      const storage = new Mem();
      storage.setItem(SAVE_KEY, JSON.stringify(save));
      const { plan, game } = load(storage);
      const s = game.state;
      const want = keepers({ ...old, ownedShips: old.ownedShips ?? {}, shipUpgrades: old.shipUpgrades ?? {}, shipLiveries: old.shipLiveries ?? {}, completedJobs: old.completedJobs } as GameState);
      const got = keepers(s);
      expect(got.ships).toEqual(want.ships);
      expect(got.upgrades).toEqual(game.state.shipUpgrades); // repaired form
      for (const [ship, up] of Object.entries(old.shipUpgrades ?? {})) expect(s.shipUpgrades[ship]).toEqual(up);
      for (const [ship, l] of Object.entries(old.shipLiveries ?? {})) expect(s.shipLiveries[ship]).toEqual(l);
      if (old.completedJobs) expect(s.completedJobs).toEqual(old.completedJobs);
      expect(s.currentDockId).toBe(startDockOf(WORLD_SEED).id);
      expect(s.currentJob).toBeNull();
      expect(s.freeTrip).toBeNull();
      expect(s.spacePlanetId).toBeNull();
      expect(s.ownedOutposts).toEqual([]);
      const outposts = (old.ownedOutposts ?? []).length;
      if (outposts) expect(s.credits).toBeGreaterThan(old.credits);
      else expect(s.credits).toBe(old.credits);
      expect(plan.notice).toMatch(/universe was rebuilt/);
      // second load: quiet, nothing written
      const after = storage.getItem(SAVE_KEY);
      const again = load(storage);
      expect(again.plan.notice).toBeNull();
      expect(again.game.state.credits).toBe(s.credits);
      expect(storage.getItem(SAVE_KEY)).toBe(after);
      // the import path gives the same game
      const src = new Mem();
      src.setItem(SAVE_KEY, JSON.stringify(save));
      const file = exportSaveFile(src, new Date(NOW));
      expect(file.ok).toBe(true);
      if (!file.ok) return;
      const target = new Mem();
      expect(applyImport(target, file.text).ok).toBe(true);
      const imported = load(target);
      expect(imported.plan.notice).toMatch(/universe was rebuilt/);
      const strip = (x: GameState) => ({ ...x, travelStartMs: null, travelEndMs: null });
      expect(strip(imported.game.state)).toEqual(strip(s));
      rows.push(
        `| ${name} | ${old.credits} -> ${s.credits}${outposts ? ` (refund ${s.credits - old.credits} for ${outposts} outposts)` : ""} | ${got.ships.join(", ")} | ${old.currentJob ? "job cancelled" : old.freeTrip ? "free trip cancelled" : old.spacePlanetId ? "was floating" : "docked"} | start dock | once, then quiet | same |`,
      );
    });
  }
  it("prints the table", () => {
    console.log(["| save | credits | ships | trip | ship lands | 'rebuilt' note | import |", ...rows].join("\n"));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(existsSync(DIR)).toBe(true);
  });
});

// ------------------------------------------------------------ 6h step 4: far-dock text
import { nearestDocks } from "../src/universe";

describe("6h: the far-dock message talks about docks in ANOTHER system", () => {
  // remote docks at the rim, split by: does their own system have other docks (0 ly away)?
  const remote = (want: "shared" | "alone"): string => {
    for (const d of nearestDocks(WORLD_SEED, { x: 49000, y: 0, z: 0 }, 200)) {
      const game = new Game(WORLD_SEED, d.dockId, createClock(1, () => NOW));
      const info = game.getPlaceInfo();
      if (!info.isRemote) continue;
      const shared = game.nearbyDocks(6).some((x) => x.systemId === info.systemId && x.dockId !== d.dockId);
      if ((want === "shared") === shared) return d.dockId;
    }
    throw new Error(`no remote dock (${want}) found`);
  };

  it("a remote dock with other docks in its own system: never 'the next dock is X ly' as if they did not exist", () => {
    const game = new Game(WORLD_SEED, remote("shared"), createClock(1, () => NOW));
    const msg = game.getPlaceInfo().remoteMessage!;
    expect(msg).toContain("The other docks in this system are just as far from everything.");
    expect(msg).toMatch(/The nearest dock in another system is [\d.]+ ly away; a full tank takes you \d+ ly\./);
    expect(msg).not.toContain("The next dock is");
  });

  it("a remote dock alone in its system: no sentence about other docks here", () => {
    const game = new Game(WORLD_SEED, remote("alone"), createClock(1, () => NOW));
    const msg = game.getPlaceInfo().remoteMessage!;
    expect(msg).not.toContain("other docks in this system");
    expect(msg).toMatch(/^Nothing here is within reach of this ship\. The nearest dock in another system is [\d.]+ ly away/);
  });
});

// ------------------------------------------------------------ 6h step 6: Agent 2's spot checks (report-agent-2f section 9)
import { docksOf as docksOfSystem, getJobBoard as jobBoard, getPlanetsOfSystem, getSystem, nearestSystems } from "../src/universe";

const BULGE_FROM = 46_600_000_000; // system numbers above 46.6 billion are bulge systems (report-agent-2f)

describe("6h: bulge systems and close disc/bulge pairs", () => {
  const centre = nearestSystems(WORLD_SEED, { x: 0, y: 0, z: 0 }, 400).map((n) => ({ systemId: n.system.id, position: n.system.position }));

  it("getSystem works for bulge numbers above 46.6 billion: planets, docks and a job board", () => {
    const bulge = centre.filter((s) => s.systemId > BULGE_FROM);
    expect(bulge.length).toBeGreaterThan(20);
    let boards = 0;
    for (const near of bulge.slice(0, 40)) {
      const sys = getSystem(WORLD_SEED, near.systemId)!;
      expect(sys).not.toBeNull();
      expect(getPlanetsOfSystem(WORLD_SEED, sys.id).length).toBe(sys.planetCount);
      const docks = docksOfSystem(WORLD_SEED, sys);
      expect(docks.length).toBeGreaterThan(0);
      const board = jobBoard(WORLD_SEED, docks[0]!.id, 0) ?? [];
      if (board.length) boards++;
      const game = new Game(WORLD_SEED, docks[0]!.id, createClock(1, () => NOW));
      expect(() => game.getBoard()).not.toThrow();
    }
    expect(boards).toBeGreaterThan(30);
  });

  it("a disc and a bulge system almost on top of each other keep their own planets and docks", () => {
    let pairs = 0;
    for (const a of centre.filter((s) => s.systemId <= BULGE_FROM)) {
      for (const b of nearestSystems(WORLD_SEED, a.position, 6).map((n) => ({ systemId: n.system.id, position: n.system.position })).filter((s) => s.systemId > BULGE_FROM)) {
        const gap = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
        if (gap > 1) continue;
        pairs++;
        const sa = getSystem(WORLD_SEED, a.systemId)!;
        const sb = getSystem(WORLD_SEED, b.systemId)!;
        const da = docksOfSystem(WORLD_SEED, sa).map((d) => d.id);
        const db = docksOfSystem(WORLD_SEED, sb).map((d) => d.id);
        expect(da.length && db.length).toBeTruthy();
        expect(da.filter((id) => db.includes(id))).toEqual([]); // no shared dock ids
        expect(getPlanetsOfSystem(WORLD_SEED, sa.id).length).toBe(sa.planetCount);
        expect(getPlanetsOfSystem(WORLD_SEED, sb.id).length).toBe(sb.planetCount);
        // a job between the twins (or their boards) never throws
        const game = new Game(WORLD_SEED, da[0]!, createClock(1, () => NOW));
        expect(() => game.getBoard()).not.toThrow();
        if (pairs >= 15) break;
      }
      if (pairs >= 15) break;
    }
    expect(pairs).toBeGreaterThan(0);
    console.log(`6h: ${pairs} close disc/bulge pairs (< 1 ly apart) checked`);
  });
});
