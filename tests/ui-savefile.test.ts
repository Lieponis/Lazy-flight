// Stage P3 (Agent 5g): the plain text and rules behind the SAVE FILE panel, the install hint and the tester speed.
import { describe, expect, it } from "vitest";
import { startSpeed } from "../src/game/clock";
import { MAX_SPEED } from "../src/game";
import type { SaveSummary } from "../src/save";
import {
  HINTS_KEY,
  HINT_TEXT,
  REPLACE_WARNING,
  SAVE_FILE_TIP,
  TEST_SPEEDS,
  TEST_SPEED_KEY,
  compareRows,
  deviceKind,
  hintToShow,
  isSaveFileName,
  repairPastedText,
  parseHints,
  storedTestSpeed,
  summaryLines,
  testSpeedLabel,
  testSpeedStatus,
  warningLines,
} from "../src/ui/savefilelogic";

const summary = (over: Partial<SaveSummary> = {}): SaveSummary => ({
  seed: 1337,
  credits: 48200,
  ships: ["Passenger Liner", "Cargo Hauler", "Scout"],
  activeShip: "Passenger Liner",
  ranks: [
    { label: "cargo", rankName: "Crate Wrangler", rankNumber: 2, jobsDone: 6 },
    { label: "passengers", rankName: "Seatbelt Sheriff", rankNumber: 3, jobsDone: 20 },
    { label: "tours", rankName: "Tour Rookie", rankNumber: 1, jobsDone: 0 },
  ],
  explorer: { rankName: "Cartographer", systems: 12, planets: 40 },
  outposts: 2,
  paintJobs: 1,
  travelling: false,
  savedAt: "2026-11-12T08:00:00.000Z",
  universeVersion: 2,
  ...over,
});

describe("P3: what a save holds, in plain words", () => {
  it("summary lines", () => {
    expect(summaryLines(summary())).toEqual([
      "48,200 CR · 3 ships (flying the Passenger Liner)",
      "Cargo: Crate Wrangler · Passengers: Seatbelt Sheriff · Tours: Tour Rookie",
      "Explorer: Cartographer · 12 systems · 40 planets",
      "2 outposts · 1 paint job",
    ]);
  });

  it("one ship, nothing extra, a trip under way", () => {
    const lines = summaryLines(summary({ ships: ["Cargo Hauler"], activeShip: "Cargo Hauler", outposts: 0, paintJobs: 0, travelling: true, explorer: { rankName: "Lost in Space", systems: 1, planets: 1 } }));
    expect(lines[0]).toBe("48,200 CR · 1 ship (flying the Cargo Hauler)");
    expect(lines).toContain("Explorer: Lost in Space · 1 system · 1 planet");
    expect(lines).toContain("A trip was under way when it was saved.");
    expect(lines.some((l) => l.includes("outpost"))).toBe(false);
  });

  it("side by side: THIS FILE vs NOW, best rank first", () => {
    const now = summary({ credits: 1240, ships: ["Cargo Hauler"], outposts: 0, ranks: [{ label: "cargo", rankName: "Box Pusher", rankNumber: 1, jobsDone: 0 }] });
    expect(compareRows(summary(), now)).toEqual([
      { label: "CREDITS", file: "48,200 CR", now: "1,240 CR" },
      { label: "SHIPS", file: "3 ships", now: "1 ship" },
      { label: "BEST RANK", file: "Seatbelt Sheriff", now: "Box Pusher" },
      { label: "EXPLORED", file: "12 sys · 40 pl", now: "12 sys · 40 pl" },
      { label: "OUTPOSTS", file: "2", now: "0" },
    ]);
  });

  it("no game here yet: the NOW column shows dashes", () => {
    expect(compareRows(summary(), null).every((r) => r.now === "-")).toBe(true);
  });

  it("warnings read as cautions, empty ones dropped", () => {
    expect(warningLines(["This save is from a different universe.", " ", "A trip was under way."])).toEqual([
      "! This save is from a different universe.",
      "! A trip was under way.",
    ]);
  });

  it("the big confirm says it replaces the game and can be undone once", () => {
    expect(REPLACE_WARNING).toMatch(/replaces/);
    expect(REPLACE_WARNING).toMatch(/UNDO/);
    expect(SAVE_FILE_TIP.length).toBeLessThan(60);
    expect(isSaveFileName("lazy-flight-save-2026-11-12.json")).toBe(true);
    expect(isSaveFileName("photo.jpg")).toBe(false);
  });
});

describe("P3: pasted text repaired the way phones break it (Andy's iPhone)", () => {
  it("fixes the start's letter case and removes spaces and line breaks, but only in the one-line text form", () => {
    expect(repairPastedText("lfsave1:eyJmb3J-_x")).toBe("LFSAVE1:eyJmb3J-_x");
    expect(repairPastedText("  Lfsave1 : eyJm\nb3J x \r\n")).toBe("LFSAVE1:eyJmb3Jx");
    expect(repairPastedText("LFSAVE1:abc")).toBe("LFSAVE1:abc");
    expect(repairPastedText('{"format":"lazy-flight-save","name":"Cargo Hauler"}')).toBe('{"format":"lazy-flight-save","name":"Cargo Hauler"}');
    expect(repairPastedText("hello")).toBe("hello");
  });

  it("a real exported text survives the iPhone change and still imports; a damaged one is still refused", async () => {
    const { Game, createClock } = await import("../src/game");
    const { getPlanetsOfSystem, listSystemsNear } = await import("../src/universe");
    const { exportSaveFile, inspectImport, makeSaveData, SAVE_KEY } = await import("../src/save");
    const sys = listSystemsNear(1337, { x: 0, y: 0, z: 0 }, 30).find((x) => getPlanetsOfSystem(1337, x.id).length > 0)!;
    const game = new Game(1337, getPlanetsOfSystem(1337, sys.id)[0]!.id, createClock(1));
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    storage.setItem(SAVE_KEY, JSON.stringify(makeSaveData(1337, game.state, game.clock.now(), Date.now())));
    const exported = exportSaveFile(storage);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const broken = `lfsave1:${exported.text.slice(8, 40)}\n${exported.text.slice(40)} `;
    expect(inspectImport(broken, 1337).ok).toBe(false); // what Andy's phone gave: refused before the fix
    expect(inspectImport(repairPastedText(broken), 1337).ok).toBe(true); // repaired: accepted
    const damaged = repairPastedText(`${exported.text.slice(0, -4)}AAAA`);
    expect(inspectImport(damaged, 1337).ok).toBe(false); // the checksum still guards the rest
  });
});

describe("P3: install hint and app tip, once only", () => {
  const none = { installHintSeen: false, appTipSeen: false };

  it("reads the flags safely", () => {
    expect(HINTS_KEY).toBe("lazy-freight.hints");
    expect(parseHints(null)).toEqual(none);
    expect(parseHints("garbage{")).toEqual(none);
    expect(parseHints('{"installHintSeen":true}')).toEqual({ installHintSeen: true, appTipSeen: false });
    expect(parseHints('{"installHintSeen":"yes","appTipSeen":true}')).toEqual({ installHintSeen: false, appTipSeen: true });
  });

  it("knows the device", () => {
    expect(deviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(deviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios"); // new iPads
    expect(deviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(deviceKind("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(deviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });

  it("shows the right note, once, only at a safe moment, never on a computer", () => {
    expect(hintToShow("ios", false, none, true)).toBe("install-ios");
    expect(hintToShow("android", false, none, true)).toBe("install-android");
    expect(hintToShow("desktop", false, none, true)).toBeNull();
    expect(hintToShow("ios", false, none, false)).toBeNull(); // during a trip or with a menu open
    expect(hintToShow("ios", false, { ...none, installHintSeen: true }, true)).toBeNull();
    expect(hintToShow("ios", true, none, true)).toBe("app-tip"); // in the installed app
    expect(hintToShow("ios", true, { ...none, appTipSeen: true }, true)).toBeNull();
    expect(HINT_TEXT["install-ios"]).toMatch(/Share.*Add to Home Screen/);
    expect(HINT_TEXT["app-tip"]).toMatch(/SAVE FILE > IMPORT/);
  });
});

describe("P3: tester speed", () => {
  it("Andy's six speeds, stored under their own key", () => {
    expect([...TEST_SPEEDS]).toEqual([1, 10, 20, 60, 300, 1000]);
    expect(TEST_SPEED_KEY).toBe("lazy-freight.testspeed");
    expect(storedTestSpeed("60")).toBe(60);
    expect(storedTestSpeed("61")).toBe(1);
    expect(storedTestSpeed(null)).toBe(1);
    expect(testSpeedLabel(1)).toBe("1x NORMAL");
    expect(testSpeedLabel(300)).toBe("300x");
  });

  it("the status line under the buttons", () => {
    expect(testSpeedStatus(1, 1, false)).toBe("Running at normal speed.");
    expect(testSpeedStatus(60, 60, false)).toMatch(/Running at 60x/);
    expect(testSpeedStatus(60, 1, false)).toMatch(/Reload/);
    expect(testSpeedStatus(60, 600, true)).toMatch(/web address/);
  });

  it("the game's start speed: the address wins, then the stored value, junk ignored, 1 when nothing set", () => {
    expect(startSpeed("?speed=120", "60")).toBe(120); // address wins
    expect(startSpeed("?seed=4&speed=10", null)).toBe(10);
    expect(startSpeed("", "60")).toBe(60); // stored value used
    expect(startSpeed("?seed=4", "1000")).toBe(1000);
    expect(startSpeed("", null)).toBe(1); // nothing set
    expect(startSpeed("", "fast")).toBe(1); // junk
    expect(startSpeed("", "-5")).toBe(1);
    expect(startSpeed("", "0")).toBe(1);
    expect(startSpeed("", " 20 ")).toBe(20);
    expect(startSpeed("", "999999999")).toBe(MAX_SPEED); // capped like ?speed=
    expect(startSpeed("?speed=junk", "60")).toBe(1); // a broken ?speed= still wins and means 1
  });
});
