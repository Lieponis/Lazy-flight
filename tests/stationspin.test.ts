// Brief 3o, fix 2: the planet under a station turns slowly. The numbers (pure) here; the ball itself in the second part (needs real three).
import { describe, expect, it } from "vitest";
import { DOCKED_STATION_ORBIT_SECONDS, STATION_ORBIT_CLOUD_EXTRA } from "../src/render/settings";
import {
  ORBIT_TURN_SECONDS,
  STATION_SUN,
  capRadiusDeg,
  nadirFromPoleDeg,
  orbitSecondsFor,
  parseOrbit,
  parseStationDemo,
  spinAngles,
  spinPhase,
} from "../src/render/stationspin";

const TWO_PI = Math.PI * 2;

describe("3o fix 2: the words in the web address", () => {
  it("?orbit= picks A, B, C or off, and anything else is left to the game", () => {
    expect(parseOrbit("?orbit=A")).toBe(300);
    expect(parseOrbit("?x=1&orbit=b")).toBe(150);
    expect(parseOrbit("?orbit=C")).toBe(60);
    expect(parseOrbit("?orbit=off")).toBe(0);
    expect(parseOrbit("")).toBeNull();
    expect(parseOrbit("?orbit=zzz")).toBeNull();
    expect(orbitSecondsFor("")).toBe(DOCKED_STATION_ORBIT_SECONDS);
    expect(orbitSecondsFor("?orbit=C")).toBe(60);
  });

  it("the three speeds are about 5, 2.5 and 1 minutes for a full turn, slow to fast", () => {
    expect(ORBIT_TURN_SECONDS.A).toBeGreaterThan(ORBIT_TURN_SECONDS.B);
    expect(ORBIT_TURN_SECONDS.B).toBeGreaterThan(ORBIT_TURN_SECONDS.C);
    expect(ORBIT_TURN_SECONDS.A / 60).toBe(5);
    expect(ORBIT_TURN_SECONDS.C / 60).toBe(1);
  });

  it("?stationdemo=1 turns the demo on; 0 and false and nothing leave it off", () => {
    expect(parseStationDemo("?stationdemo=1")).toBe(true);
    expect(parseStationDemo("?a=b&stationdemo=yes")).toBe(true);
    expect(parseStationDemo("?stationdemo=0")).toBe(false);
    expect(parseStationDemo("?stationdemo=false")).toBe(false);
    expect(parseStationDemo("")).toBe(false);
  });
});

describe("3o fix 2: the turn", () => {
  it("the same planet always starts at the same place; other planets start elsewhere", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `${40000 + i * 7919}/${i % 6}`);
    for (const id of ids) {
      expect(spinPhase(id)).toBe(spinPhase(id));
      expect(spinPhase(id)).toBeGreaterThanOrEqual(0);
      expect(spinPhase(id)).toBeLessThan(TWO_PI);
    }
    expect(new Set(ids.map(spinPhase)).size).toBeGreaterThan(150);
  });

  it("one full turn takes exactly the turn time, half a turn takes half", () => {
    const phase = 1.25;
    const start = spinAngles(0, 300, phase);
    expect(start.ground).toBeCloseTo(phase, 9);
    expect(start.clouds).toBe(0);
    expect(spinAngles(150, 300, phase).ground - phase).toBeCloseTo(Math.PI, 9);
    expect(spinAngles(75, 300, phase).ground - phase).toBeCloseTo(Math.PI / 2, 9);
    // after a whole turn it is back where it began (the picture repeats), and a long visit never goes wrong
    expect(Math.cos(spinAngles(300, 300, phase).ground)).toBeCloseTo(Math.cos(phase), 9);
    expect(Math.cos(spinAngles(300 * 40 + 75, 300, phase).ground - phase)).toBeCloseTo(Math.cos(Math.PI / 2), 6);
  });

  it("off (0 seconds) stands still at its start place, whatever the time", () => {
    for (const t of [0, 1, 99, 5000]) {
      const a = spinAngles(t, 0, 2);
      expect(a.ground).toBe(2);
      expect(a.clouds).toBe(0);
    }
  });

  it("the clouds drift a touch faster than the ground, not a lot", () => {
    const a = spinAngles(100, 300, 0);
    expect(a.clouds).toBeCloseTo(a.ground * STATION_ORBIT_CLOUD_EXTRA, 9);
    expect(STATION_ORBIT_CLOUD_EXTRA).toBeGreaterThan(0);
    expect(STATION_ORBIT_CLOUD_EXTRA).toBeLessThanOrEqual(0.3);
  });
});

describe("3o fix 2: the pole and the ice caps are not at the slot", () => {
  it("the sun keeps its old direction (same light as before)", () => {
    const l = Math.hypot(0.45, 0.5, 0.75);
    expect(STATION_SUN.x).toBeCloseTo(0.45 / l, 9);
    expect(STATION_SUN.y).toBeCloseTo(0.5 / l, 9);
    expect(STATION_SUN.z).toBeCloseTo(0.75 / l, 9);
    expect(Math.hypot(STATION_SUN.x, STATION_SUN.y, STATION_SUN.z)).toBeCloseTo(1, 9);
  });

  it("the spot straight below the station is about 60 degrees from the pole (before: right on it)", () => {
    expect(nadirFromPoleDeg()).toBeGreaterThan(58);
    expect(nadirFromPoleDeg()).toBeLessThan(62);
  });

  it("every ice cap (they start at 0.75 to 0.9 of the way to the pole) stays at least 18 degrees away from that spot", () => {
    for (let caps = 0.75; caps <= 0.9001; caps += 0.01) {
      expect(nadirFromPoleDeg() - capRadiusDeg(caps)).toBeGreaterThanOrEqual(18);
    }
  });
});
