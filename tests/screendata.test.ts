import { describe, expect, it } from "vitest";
import {
  PHASE_LABELS,
  SCREEN_PIXEL_WIDTH,
  canvasHeightFor,
  fuelScreenData,
  infoPage,
  infoScreenData,
  messageIndexFor,
  mapScreenData,
  shortText,
  twoLines,
} from "../src/render/screendata";
import type { FlightPlan } from "../src/render/flightplan";

const plan = (over: Partial<FlightPlan> = {}): FlightPlan => ({ phase: "WARP", progress: 0.5, phaseSeconds: 10, elapsedSeconds: 30, totalSeconds: 90, ...over });

describe("cockpit screens: the information screen", () => {
  it("shows the destination, the time left and the phase", () => {
    const d = infoScreenData("Kopi Station", plan());
    expect(d.destination).toBe("Kopi Station");
    expect(d.countdown).toBe("1:00");
    expect(d.phase).toBe("WARP");
  });
  it("names every phase, and says ARRIVED with no time left at the end", () => {
    expect(PHASE_LABELS.LAUNCH).toBe("LAUNCH");
    expect(PHASE_LABELS.APPROACH).toBe("APPROACH");
    const d = infoScreenData("X", plan({ phase: "DONE", elapsedSeconds: 90 }));
    expect(d.phase).toBe("ARRIVED");
    expect(d.countdown).toBe("0:00");
  });
  it("never shows a negative time or an empty destination", () => {
    expect(infoScreenData("  ", plan({ elapsedSeconds: 500 })).destination).toBe("UNKNOWN");
    expect(infoScreenData("A", plan({ elapsedSeconds: 500 })).countdown).toBe("0:00");
  });
  it("long names are cut to fit, in capitals, over at most two lines", () => {
    expect(shortText("abc", 5)).toBe("ABC");
    expect(shortText("abcdefghij", 5)).toBe("ABCD.");
    expect(twoLines("Kopipex Prime Outpost", 11)).toEqual(["KOPIPEX", "PRIME OUTP."]);
    expect(twoLines("Short", 11)).toEqual(["SHORT", ""]);
    const [a] = twoLines("Supercalifragilistic", 8);
    expect(a.length).toBeLessThanOrEqual(8);
  });
});

describe("cockpit screens: the map", () => {
  it("the ship starts at the origin and ends at the destination", () => {
    const start = mapScreenData(0, 1);
    const end = mapScreenData(1, 1);
    expect(start.ship).toEqual(start.origin);
    expect(end.ship.x).toBeCloseTo(end.destination.x, 9);
    expect(end.ship.y).toBeCloseTo(end.destination.y, 9);
  });
  it("the ship moves along the line as the trip goes on", () => {
    const a = mapScreenData(0.25, 1).ship;
    const b = mapScreenData(0.75, 1).ship;
    expect(b.x).toBeGreaterThan(a.x);
  });
  it("the stars stay where they are for one trip, and differ between trips", () => {
    expect(mapScreenData(0.1, 7).stars).toEqual(mapScreenData(0.9, 7).stars);
    expect(JSON.stringify(mapScreenData(0.1, 7).stars) === JSON.stringify(mapScreenData(0.1, 8).stars)).toBe(false);
    for (const s of mapScreenData(0, 3, 40).stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });
  it("a broken fraction does not break the map", () => {
    expect(mapScreenData(Number.NaN, 1).ship).toEqual(mapScreenData(0, 1).ship);
    expect(mapScreenData(5, 1).ship).toEqual(mapScreenData(1, 1).ship);
  });
});

describe("cockpit screens: fuel", () => {
  it("drains from the full-trip start down to what is left at arrival", () => {
    const info = { fuel: 40, fuelMax: 100, fuelUsed: 20 };
    expect(fuelScreenData(info, 0).value).toBe(60);
    expect(fuelScreenData(info, 0.5).value).toBe(50);
    expect(fuelScreenData(info, 1).value).toBe(40);
    expect(fuelScreenData(info, 1).text).toBe("40/100");
    expect(fuelScreenData(info, 0).fraction).toBeCloseTo(0.6, 9);
  });
  it("without the trip's use the number stays at what is left", () => {
    expect(fuelScreenData({ fuel: 33, fuelMax: 60 }, 0.3).value).toBe(33);
  });
  it("without fuel information the screen shows dashes", () => {
    expect(fuelScreenData({}, 0.5)).toEqual({ available: false, value: 0, max: 0, fraction: 0, text: "--" });
    expect(fuelScreenData({ fuel: 10 }, 0.5).available).toBe(false);
    expect(fuelScreenData({ fuel: 10, fuelMax: 0 }, 0.5).available).toBe(false);
    expect(fuelScreenData({ fuel: Number.NaN, fuelMax: 10 }, 0.5).available).toBe(false);
  });
  it("never goes below empty or above the tank", () => {
    expect(fuelScreenData({ fuel: -5, fuelMax: 50, fuelUsed: 0 }, 0).value).toBe(0);
    expect(fuelScreenData({ fuel: 50, fuelMax: 50, fuelUsed: 30 }, 0).value).toBe(50);
  });
});

describe("cockpit screens: picture size", () => {
  it("keeps the shape of the screen so the picture is never stretched", () => {
    expect(canvasHeightFor(96, 1, 1.2)).toBe(Math.round(96 * 1.2));
    expect(canvasHeightFor(96, 1, 100)).toBe(160);
    expect(canvasHeightFor(96, 100, 1)).toBe(32);
    expect(canvasHeightFor(96, 0, 0)).toBe(96);
  });
});

describe("cockpit screens: status page and funny messages", () => {
  const lines = ["one", "two", "three"];
  it("shows the facts for the first part of each round and a funny line for the rest", () => {
    expect(infoPage(0, 10, 5)).toEqual({ page: "status", round: 0 });
    expect(infoPage(9.9, 10, 5)).toEqual({ page: "status", round: 0 });
    expect(infoPage(10, 10, 5)).toEqual({ page: "message", round: 0 });
    expect(infoPage(14.9, 10, 5)).toEqual({ page: "message", round: 0 });
    expect(infoPage(15, 10, 5)).toEqual({ page: "status", round: 1 });
    expect(infoPage(-3, 10, 5).page).toBe("status");
  });
  it("every round brings a different line and the list wraps round", () => {
    expect(messageIndexFor(0, 3, 0)).toBe(0);
    expect(messageIndexFor(1, 3, 0)).toBe(1);
    expect(messageIndexFor(3, 3, 0)).toBe(0);
    expect(messageIndexFor(0, 3, 2)).toBe(2);
    expect(messageIndexFor(5, 0, 0)).toBe(0);
  });
  it("the info screen gets the line for the current round", () => {
    const d = infoScreenData("X", plan({ elapsedSeconds: 12 }), lines, 0, 10, 5);
    expect(d.page).toBe("message");
    expect(d.message).toBe("one");
    expect(infoScreenData("X", plan({ elapsedSeconds: 27 }), lines, 0, 10, 5).message).toBe("two");
  });
  it("the status page still has the destination, time and phase during a message round", () => {
    const d = infoScreenData("Kopi", plan({ elapsedSeconds: 12 }), lines, 0, 10, 5);
    expect(d.destination).toBe("Kopi");
    expect(d.phase).toBe("WARP");
  });
  it("arriving always shows the facts, and with no lines there are no messages", () => {
    expect(infoScreenData("X", plan({ phase: "DONE", elapsedSeconds: 12 }), lines, 0, 10, 5).page).toBe("status");
    expect(infoScreenData("X", plan({ elapsedSeconds: 12 }), [], 0, 10, 5).page).toBe("status");
  });
});
