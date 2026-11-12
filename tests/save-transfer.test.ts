// Agent 6e (stage P2): save file export and import. Every import is followed through the WHOLE start path a page
// load uses (planStart -> migrate -> new Game -> loadIntoGame -> autosave), because a crash once slipped past
// smaller unit tests (F1).
import { describe, expect, it } from "vitest";
import { Game, createClock, newGameState, normalizeState, type GameState } from "../src/game";
import { DEFAULT_PREFS, PREFS_KEY, normalizePrefs } from "../src/audio/prefs";
import {
  BEFORE_IMPORT_KEY,
  MAX_IMPORT_CHARS,
  REFUSE_BROKEN,
  REFUSE_DAMAGED,
  REFUSE_EMPTY,
  REFUSE_NEWER,
  REFUSE_NOTHING_TO_EXPORT,
  REFUSE_NOT_A_SAVE,
  REFUSE_NO_STORAGE,
  REFUSE_NO_UNDO,
  REFUSE_TOO_BIG,
  REFUSE_WRITE_FAILED,
  SAVE_GENERATION_KEY,
  SAVE_KEY,
  SAVE_TEXT_PREFIX,
  SOUND_KEY,
  WARN_OLD_UNIVERSE,
  WARN_OTHER_SEED,
  WARN_TRAVELLING,
  applyImport,
  canUndoImport,
  cleanSoundSettings,
  exportSaveFile,
  inspectImport,
  loadIntoGame,
  makeSaveData,
  planStart,
  saveFileChecksum,
  saveFileName,
  startAutoSave,
  undoImport,
  writeSave,
  type PageEvents,
  type SaveData,
  type StorageLike,
} from "../src/save";
import { UNIVERSE_VERSION, docksOf, getJobBoard, listSystemsNear, startDockOf } from "../src/universe";

const SEED = 12345;
const START = startDockOf(SEED).id;

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
  snapshot(): Record<string, string> {
    return Object.fromEntries([...this.data.entries()].sort());
  }
}

/** One page load, exactly like src/ui/index.ts + main.ts do it (without the 3D layer). */
function boot(storage: StorageLike, now: number, page: PageEvents | null = null) {
  const plan = planStart("", storage, SEED);
  const start = startDockOf(plan.seed).id;
  const game = new Game(plan.seed, start, createClock(1, () => now));
  if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, start, now);
  const saver = startAutoSave(game, storage, page, () => now);
  // touch everything a screen would show, so a broken field would throw here
  game.getBoard();
  game.getRanks();
  game.getExplorer();
  game.getShipCatalog();
  game.getOwnedOutposts();
  for (const id of [game.state.shipId, ...Object.keys(game.state.ownedShips)]) game.getLiveryCatalog(id);
  return { plan, game, saver };
}

/** A rich, played-looking state: credits, three ships, upgrades, paint jobs, outposts with prices, ranks, explored list. */
function richState(): GameState {
  const outposts: string[] = [];
  for (const system of listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 40)) {
    for (const dock of docksOf(SEED, system)) if (dock.kind === "OUTPOST" && outposts.length < 2) outposts.push(dock.id);
  }
  const explored: Record<string, number> = {};
  for (const s of listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 30).slice(0, 25)) explored[s.id] = 0b111;
  return normalizeState({
    ...newGameState(START),
    credits: 54_321,
    fuel: 41,
    shipId: "scout",
    ownedShips: { "cargo-hauler": { fuel: 12 }, "passenger-liner": { fuel: 77 } },
    shipUpgrades: { scout: { tank: 2, hold: 1, engines: 3, comfort: 1 }, "cargo-hauler": { tank: 1, hold: 0, engines: 0, comfort: 0 } },
    shipLiveries: { scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } },
    completedJobs: { TRADE: 9, PASSENGER: 3, TOUR: 1 },
    ownedOutposts: outposts,
    outpostPrices: Object.fromEntries(outposts.map((id, i) => [id, 7000 + i * 1000])),
    outpostCount: outposts.length,
    explored,
    deliveredJobIds: [],
  });
}

function storageWithSave(state: GameState, extra: Partial<SaveData> = {}, sound: object | null = { muted: true, music: 0.2, effects: 0.9 }): MemoryStorage {
  const s = new MemoryStorage();
  s.setItem(SAVE_KEY, JSON.stringify({ ...makeSaveData(SEED, state, 1_000, 2_000), ...extra }));
  if (sound) s.setItem(PREFS_KEY, JSON.stringify(sound));
  return s;
}

const NOW = Date.UTC(2026, 10, 12, 8, 0, 0);

function exported(storage: StorageLike): { json: string; text: string } {
  const r = exportSaveFile(storage, new Date(NOW));
  if (!r.ok) throw new Error(r.reason);
  return r;
}

// ------------------------------------------------------------ export

describe("export", () => {
  it("makes a file name, JSON, one-line text and a summary, and changes nothing", () => {
    const storage = storageWithSave(richState());
    const before = storage.snapshot();
    const r = exportSaveFile(storage, new Date(2026, 10, 12, 9, 30));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filename).toBe("lazy-flight-save-2026-11-12.json");
    expect(r.text.startsWith(SAVE_TEXT_PREFIX)).toBe(true);
    expect(r.text).toMatch(/^LFSAVE1:[A-Za-z0-9_-]+$/); // safe to paste: no spaces, no line breaks
    const file = JSON.parse(r.json);
    expect(file.format).toBe("lazy-flight-save");
    expect(file.formatVersion).toBe(1);
    expect(file.save).toEqual(JSON.parse(before[SAVE_KEY]!)); // exactly what storage holds
    expect(file.sound).toEqual({ muted: true, music: 0.2, effects: 0.9 });
    expect(file.checksum).toMatch(/^cyrb53:[0-9a-f]{14}$/);
    expect(r.summary).toMatchObject({ seed: SEED, credits: 54_321, activeShip: "Scout", outposts: 2, paintJobs: 1, travelling: false });
    expect(r.summary.ships).toEqual(["Scout", "Cargo Hauler", "Passenger Liner"]);
    expect(r.summary.ranks.map((x) => x.jobsDone)).toEqual([9, 3, 1]);
    expect(r.summary.explorer.systems).toBe(25);
    expect(storage.snapshot()).toEqual(before);
  });

  it("only game data is in the file (no email, no device information)", () => {
    const r = exported(storageWithSave(richState()));
    const file = JSON.parse(r.json);
    expect(Object.keys(file).sort()).toEqual(["appVersion", "checksum", "exportedAt", "format", "formatVersion", "save", "sound", "summary"]);
    expect(r.json).not.toMatch(/@|userAgent|navigator|Mozilla|iPhone/);
  });

  it("works mid-trip: exports what the autosave holds", () => {
    const state = richState();
    const job = getJobBoard(SEED, START, 0)![0]!;
    const flying = { ...state, shipId: "cargo-hauler", ownedShips: { scout: { fuel: 41 }, "passenger-liner": { fuel: 77 } }, currentJob: job, travelStartMs: 1_000, travelEndMs: 1_000 + 3_600_000 };
    const r = exportSaveFile(storageWithSave(flying), new Date(NOW));
    expect(r.ok && r.summary.travelling).toBe(true);
  });

  it("refuses plainly when there is nothing to export or no storage", () => {
    expect(exportSaveFile(new MemoryStorage())).toEqual({ ok: false, reason: REFUSE_NOTHING_TO_EXPORT });
    expect(exportSaveFile(null)).toEqual({ ok: false, reason: REFUSE_NO_STORAGE });
    const broken = new MemoryStorage();
    broken.setItem(SAVE_KEY, "{oops");
    expect(exportSaveFile(broken)).toEqual({ ok: false, reason: REFUSE_NOTHING_TO_EXPORT });
    expect(broken.getItem(SAVE_KEY)).toBe("{oops"); // export never moves or deletes anything
  });

  it("file names use the date", () => {
    expect(saveFileName(new Date(2027, 0, 5))).toBe("lazy-flight-save-2027-01-05.json");
  });
});

// ------------------------------------------------------------ round trip through the whole path

describe("round trip: export, wipe, import, load", () => {
  for (const form of ["text", "json"] as const) {
    it(`gives back the identical game (${form} form): ships, upgrades, paint, outposts and prices, ranks, explored list`, () => {
      const state = richState();
      const source = storageWithSave(state);
      const file = exported(source)[form];

      const target = new MemoryStorage(); // a wiped phone / the installed app
      const r = applyImport(target, file);
      expect(r).toMatchObject({ ok: true, reloadNeeded: true });

      const { game } = boot(target, NOW);
      const keep = (s: GameState) => ({ ...s, travelStartMs: null, travelEndMs: null });
      expect(keep(game.state)).toEqual(keep(state));
      expect(game.state.explored).toEqual(state.explored);
      expect(game.state.outpostPrices).toEqual(state.outpostPrices);
      expect(game.currentLivery("scout")).toBe("rescue-red");
      expect(JSON.parse(target.getItem(PREFS_KEY)!)).toEqual({ muted: true, music: 0.2, effects: 0.9 });
    });
  }

  it("a trip under way survives the move and still lands and pays", () => {
    const job = getJobBoard(SEED, START, 0)![0]!;
    const flying = { ...richState(), shipId: "cargo-hauler", ownedShips: { scout: { fuel: 41 } }, fuel: 60, currentJob: job, travelStartMs: 1_000, travelEndMs: 1_000 + 60_000 };
    const target = new MemoryStorage();
    expect(applyImport(target, exported(storageWithSave(flying)).text).ok).toBe(true);
    const { game } = boot(target, NOW);
    // time away counts (the save was made long before NOW): it lands at once and pays
    const credits = game.state.credits;
    const arrival = game.update();
    expect(arrival).not.toBeNull();
    expect(game.state.credits).toBeGreaterThan(credits);
  });

  it("a file without sound settings leaves the sound settings alone", () => {
    const target = new MemoryStorage();
    target.setItem(PREFS_KEY, JSON.stringify({ muted: false, music: 0.33, effects: 0.44 }));
    applyImport(target, exported(storageWithSave(richState(), {}, null)).text);
    expect(JSON.parse(target.getItem(PREFS_KEY)!)).toEqual({ muted: false, music: 0.33, effects: 0.44 });
  });
});

// ------------------------------------------------------------ old saves import through the whole path

/** Builds a file exactly as export would, around any save content (old versions never had export, so we wrap them). */
function fileAround(save: unknown, sound: object | null = null): string {
  const s = new MemoryStorage();
  s.setItem(SAVE_KEY, JSON.stringify(save));
  if (sound) s.setItem(PREFS_KEY, JSON.stringify(sound));
  return exported(s).text;
}

describe("every old save version imports and the game loads it", () => {
  it("universe v1 (no universeVersion): moved, outposts refunded, explored cleared, with a warning", () => {
    const state = { ...richState(), currentDockId: "1:1:1:0/6" };
    const { universeVersion: _u, ...old } = makeSaveData(SEED, state, 1, 1);
    void _u;
    const check = inspectImport(fileAround(old));
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.warnings).toContain(WARN_OLD_UNIVERSE);
    const target = new MemoryStorage();
    expect(applyImport(target, fileAround(old)).ok).toBe(true);
    const { game, plan } = boot(target, NOW);
    expect(plan.notice).toMatch(/universe was rebuilt/);
    expect(game.state.currentDockId).toBe(START);
    expect(game.state.ownedOutposts).toEqual([]);
    expect(game.state.credits).toBe(54_321 + 7000 + 8000); // refund of the two stored prices
    expect(game.state.explored).toEqual({});
    expect(game.state.ownedShips).toHaveProperty("passenger-liner");
  });

  it("before F1 (no spacePlanetId, freeTrip, explored) and before 4g (no shipLiveries)", () => {
    for (const drop of [["spacePlanetId", "freeTrip", "explored"], ["shipLiveries"], ["spacePlanetId", "freeTrip", "explored", "shipLiveries", "shipUpgrades", "deliveredJobIds", "ownedShips", "outpostPrices"]]) {
      const raw: Record<string, unknown> = { ...richState() };
      for (const k of drop) delete raw[k];
      const save = { ...makeSaveData(SEED, raw as unknown as GameState, 1, 1), universeVersion: UNIVERSE_VERSION };
      const target = new MemoryStorage();
      const r = applyImport(target, fileAround(save));
      expect(r.ok).toBe(true);
      const { game } = boot(target, NOW);
      expect(game.state.credits).toBe(54_321);
      expect(game.state.spacePlanetId).toBeNull();
      expect(game.getBoard().length).toBeGreaterThan(0);
    }
  });

  it("very old fields with wrong types are repaired, never a crash", () => {
    const raw = { ...richState(), credits: "lots", fuel: -5, shipId: "x-wing", explored: [1, 2], shipLiveries: 7, freeTrip: 3 } as unknown as GameState;
    const target = new MemoryStorage();
    expect(applyImport(target, fileAround(makeSaveData(SEED, raw, 1, 1))).ok).toBe(true);
    const { game } = boot(target, NOW);
    expect(game.state.shipId).toBe("cargo-hauler");
    expect(Number.isFinite(game.state.credits)).toBe(true);
  });
});

// ------------------------------------------------------------ refusals: plain text, storage unchanged

describe("refusals leave storage untouched", () => {
  const good = (): { text: string; json: string } => exported(storageWithSave(richState()));

  function refused(input: string, reason: string): void {
    const target = storageWithSave({ ...richState(), credits: 11 });
    const before = target.snapshot();
    expect(inspectImport(input)).toEqual({ ok: false, reason });
    expect(applyImport(target, input)).toEqual({ ok: false, reason });
    expect(target.snapshot()).toEqual(before);
  }

  it("empty, spaces only", () => {
    refused("", REFUSE_EMPTY);
    refused("   \n ", REFUSE_EMPTY);
  });

  it("garbage, another game's JSON, an array, a bare save without the file wrapper", () => {
    refused("hello there", REFUSE_NOT_A_SAVE);
    refused('{"name":"another game","credits":5}', REFUSE_NOT_A_SAVE);
    refused("[1,2,3]", REFUSE_NOT_A_SAVE);
    refused(JSON.stringify(makeSaveData(SEED, richState(), 1, 1)), REFUSE_NOT_A_SAVE);
  });

  it("corrupt JSON and truncated text or file", () => {
    const { text, json } = good();
    refused(json.slice(0, json.length - 40), REFUSE_NOT_A_SAVE);
    refused(text.slice(0, Math.floor(text.length * 0.7)), REFUSE_DAMAGED);
    refused(`${SAVE_TEXT_PREFIX}!!!not base64!!!`, REFUSE_DAMAGED);
  });

  it("an edited file (credits changed by hand): bad checksum", () => {
    const file = JSON.parse(good().json);
    file.save.state.credits = 99_999_999;
    refused(JSON.stringify(file), REFUSE_DAMAGED);
    const noSum = JSON.parse(good().json);
    delete noSum.checksum;
    refused(JSON.stringify(noSum), REFUSE_DAMAGED);
  });

  it("a huge file", () => {
    refused(`{"x":"${"a".repeat(MAX_IMPORT_CHARS)}"}`, REFUSE_TOO_BIG);
  });

  it("too new: file format, save version or universe version (sealed with a correct checksum, as a newer game would)", () => {
    const sealed = (edit: (f: Record<string, any>) => void): string => {
      const f = JSON.parse(good().json);
      edit(f);
      delete f.checksum;
      f.checksum = saveFileChecksum(f);
      return JSON.stringify(f);
    };
    refused(sealed((f) => (f.formatVersion = 2)), REFUSE_NEWER);
    refused(sealed((f) => (f.save.version = 2)), REFUSE_NEWER);
    refused(sealed((f) => (f.save.universeVersion = UNIVERSE_VERSION + 1)), REFUSE_NEWER);
    // and the same file sealed honestly but unchanged is accepted (so the helper itself is right)
    expect(inspectImport(sealed(() => {})).ok).toBe(true);
  });

  it("no storage (private window)", () => {
    expect(applyImport(null, good().text)).toEqual({ ok: false, reason: REFUSE_NO_STORAGE });
  });

  it("storage that refuses to write: nothing changed, plain reason", () => {
    const target = storageWithSave({ ...richState(), credits: 11 });
    const before = target.snapshot();
    let calls = 0;
    const flaky: StorageLike = {
      getItem: (k) => target.getItem(k),
      setItem: (k, v) => {
        calls++;
        if (k === SAVE_KEY && calls < 5) throw new Error("QuotaExceededError");
        target.setItem(k, v);
      },
      removeItem: (k) => target.removeItem(k),
    };
    expect(applyImport(flaky, good().text)).toEqual({ ok: false, reason: REFUSE_WRITE_FAILED });
    expect(target.getItem(SAVE_KEY)).toBe(before[SAVE_KEY]);
    expect(target.getItem(PREFS_KEY)).toBe(before[PREFS_KEY]);
  });
});

// ------------------------------------------------------------ backup, undo, two imports

describe("backup and undo", () => {
  it("import keeps the old save; undo brings it back; undo again brings the import back (it swaps)", () => {
    const mine = { ...richState(), credits: 111 };
    const target = storageWithSave(mine, {}, { muted: false, music: 0.1, effects: 0.1 });
    const myText = target.getItem(SAVE_KEY);
    expect(canUndoImport(target)).toBe(false);
    expect(undoImport(target)).toEqual({ ok: false, reason: REFUSE_NO_UNDO });

    const theirs = exported(storageWithSave({ ...richState(), credits: 999 })).text;
    expect(applyImport(target, theirs).ok).toBe(true);
    expect(canUndoImport(target)).toBe(true);
    expect(JSON.parse(target.getItem(BEFORE_IMPORT_KEY)!).save).toBe(myText);
    expect(boot(target, NOW).game.state.credits).toBe(999);

    expect(undoImport(target)).toEqual({ ok: true, reloadNeeded: true, restored: "save" });
    expect(boot(target, NOW).game.state.credits).toBe(111);
    expect(JSON.parse(target.getItem(PREFS_KEY)!)).toEqual({ muted: false, music: 0.1, effects: 0.1 });

    expect(undoImport(target).ok).toBe(true); // redo
    expect(boot(target, NOW).game.state.credits).toBe(999);
  });

  it("undo on a device that had no save before: back to an empty start", () => {
    const target = new MemoryStorage();
    applyImport(target, exported(storageWithSave(richState())).text);
    expect(undoImport(target)).toMatchObject({ ok: true, restored: "empty" });
    expect(target.getItem(SAVE_KEY)).toBeNull();
    expect(target.getItem(PREFS_KEY)).toBeNull();
    expect(boot(target, NOW).plan.why).toBe("fresh");
  });

  it("two imports in a row: undo goes back ONE step (to the first import)", () => {
    const target = storageWithSave({ ...richState(), credits: 1 });
    applyImport(target, exported(storageWithSave({ ...richState(), credits: 2 })).text);
    applyImport(target, exported(storageWithSave({ ...richState(), credits: 3 })).text);
    expect(boot(target, NOW).game.state.credits).toBe(3);
    undoImport(target);
    expect(boot(target, NOW).game.state.credits).toBe(2);
  });
});

// ------------------------------------------------------------ the running game cannot overwrite an import

describe("the autosave of the game still open cannot overwrite an import", () => {
  it("after an import, the old game's saves (change, page hidden, page closing) write nothing", () => {
    const target = storageWithSave({ ...richState(), credits: 111 });
    let hidden: (() => void) | null = null;
    const page: PageEvents = { onHidden: (fn) => (hidden = fn) };
    const { game, saver } = boot(target, NOW, page); // the game is running with 111 credits
    expect(saver.saveNow()).toBe(true);

    expect(applyImport(target, exported(storageWithSave({ ...richState(), credits: 999 })).text).ok).toBe(true);
    const imported = target.getItem(SAVE_KEY);

    game.loadState({ ...game.state, credits: 5 }); // a change in the old game -> autosave
    hidden!(); // the page is hidden / closing (what a reload does) -> autosave
    expect(saver.saveNow()).toBe(false);
    expect(saver.working).toBe(true); // stopped on purpose, not broken
    expect(target.getItem(SAVE_KEY)).toBe(imported);
    expect(boot(target, NOW).game.state.credits).toBe(999); // the reload starts the import
  });

  it("the same after an undo, and a new page load saves normally again", () => {
    const target = storageWithSave({ ...richState(), credits: 111 });
    applyImport(target, exported(storageWithSave({ ...richState(), credits: 999 })).text);
    const second = boot(target, NOW); // the reloaded page, now on the import
    undoImport(target);
    second.game.loadState({ ...second.game.state, credits: 7 });
    expect(boot(target, NOW).game.state.credits).toBe(111);
    const third = boot(target, NOW);
    third.game.loadState({ ...third.game.state, credits: 4242 });
    expect(boot(target, NOW).game.state.credits).toBe(4242);
    expect(target.getItem(SAVE_GENERATION_KEY)).not.toBeNull();
  });
});

// ------------------------------------------------------------ odd but harmless files

describe("odd but harmless files", () => {
  it("unknown extra fields are dropped safely (top level, in the save, in the state)", () => {
    const f = JSON.parse(exported(storageWithSave(richState())).json);
    f.somethingNew = { a: 1 }; // top level: not covered by the checksum, ignored
    const r = inspectImport(JSON.stringify(f));
    expect(r.ok).toBe(true);
    const target = new MemoryStorage();
    expect(applyImport(target, JSON.stringify(f)).ok).toBe(true);
    expect(target.getItem(SAVE_KEY)).not.toContain("somethingNew");
  });

  it("pasted text with spaces or line breaks around it still works", () => {
    const { text } = exported(storageWithSave(richState()));
    expect(inspectImport(`  \n${text}\n  `).ok).toBe(true);
    const broken = `${text.slice(0, 50)}\n${text.slice(50)}`; // a phone that wrapped the line
    expect(inspectImport(broken).ok).toBe(true);
  });

  it("a different seed gives a warning, not a refusal", () => {
    const r = inspectImport(exported(storageWithSave(richState())).text, 777);
    expect(r.ok && r.warnings).toContain(WARN_OTHER_SEED);
  });

  it("a trip under way gives a warning", () => {
    const job = getJobBoard(SEED, START, 0)![0]!;
    const flying = { ...richState(), shipId: "cargo-hauler", ownedShips: { scout: { fuel: 41 } }, currentJob: job, travelStartMs: 1, travelEndMs: 2 };
    const r = inspectImport(exported(storageWithSave(flying)).text);
    expect(r.ok && r.warnings).toContain(WARN_TRAVELLING);
  });

  it("sound settings with nonsense values are cleaned", () => {
    const s = storageWithSave(richState(), {}, null);
    s.setItem(PREFS_KEY, JSON.stringify({ muted: "yes", music: 9, effects: -1 }));
    const target = new MemoryStorage();
    applyImport(target, exported(s).text);
    expect(JSON.parse(target.getItem(PREFS_KEY)!)).toEqual({ muted: DEFAULT_PREFS.muted, music: 1, effects: 0 });
  });

  it("a save that cannot load (no dock) is refused as broken", () => {
    const f = JSON.parse(exported(storageWithSave(richState())).json);
    expect(f.save.state.currentDockId).toBeTruthy();
    // a save with state but no dock can never come out of export (export checks it); inspect refuses it as damaged
    f.save.state.currentDockId = "";
    expect(inspectImport(JSON.stringify(f))).toMatchObject({ ok: false });
  });

  it("nothing in the file is ever run: a script-looking text is just data", () => {
    const f = JSON.parse(exported(storageWithSave(richState())).json);
    f.summary.activeShip = "<img src=x onerror=alert(1)>";
    // the summary is never trusted: inspect rebuilds it from the save, and the edit breaks the checksum anyway
    expect(inspectImport(JSON.stringify(f))).toEqual({ ok: false, reason: REFUSE_DAMAGED });
    expect(REFUSE_BROKEN).toBeTruthy();
    expect(REFUSE_NEWER).toMatch(/newer version/);
  });
});

describe("sound settings: the save file and src/audio agree", () => {
  it("same key, same defaults, same cleaning", () => {
    expect(SOUND_KEY).toBe(PREFS_KEY);
    for (const raw of [null, {}, { muted: true, music: 0.3, effects: 0.4 }, { muted: "x", music: 7, effects: -2 }, { music: Number.NaN }, [], 5]) {
      expect(cleanSoundSettings(raw)).toEqual(normalizePrefs(raw));
    }
  });
});
