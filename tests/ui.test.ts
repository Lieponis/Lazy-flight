import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Game, createClock, refuel, newGameState, type BoardEntry } from "../src/game";
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
  overlayAllowed,
  refuelButton,
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
    expect(blockedReason("something-new")).toBe("Not available");
  });

  it("shows the location, or where you are going while flying", () => {
    expect(locationText({ flying: false, dockName: "Rusty Pad", systemName: "Sol" })).toBe("Rusty Pad · Sol");
    expect(locationText({ flying: true, dockName: "Rusty Pad", systemName: "Sol" })).toBe("EN ROUTE TO Rusty Pad · Sol");
  });
});

describe("ui: job cards", () => {
  it("builds the text of a takeable card", () => {
    const entry: BoardEntry = { job: fakeJob(), fuelNeeded: 9, tripSeconds: 200, block: null };
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
    expect(visibleControls("docked", "none", false)).toEqual({ statusStrip: true, dockButtons: true, mapBar: false, mapTab: null });
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
    expect(visibleControls("flight", "none", true)).toEqual({ statusStrip: true, dockButtons: false, mapBar: false, mapTab: null });
    // a job in progress hides the buttons even before the flight screen shows
    expect(visibleControls("docked", "none", true).dockButtons).toBe(false);
  });

  it("menus only stay open in the docked view", () => {
    expect(overlayAllowed("docked", "jobs", false)).toBe("jobs");
    expect(overlayAllowed("flight", "jobs", true)).toBe("none");
    expect(overlayAllowed("starmap", "arrival", false)).toBe("none");
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
