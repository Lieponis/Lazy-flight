// Brief 3o, fix 2: the station goes round its planet. The numbers (pure) here; the real ball and the sky in stationworld.test.ts.
import { describe, expect, it } from "vitest";
import {
  DOCKED_STATION_ORBIT_SECONDS,
  DOCKED_STATION_PLANET_ALTITUDE,
  DOCKED_STATION_PLANET_RADIUS,
  STATION_ORBIT_INCLINATION_DEG,
  STATION_START_SPREAD_DEG,
} from "../src/render/settings";
import {
  ORBIT_TURN_SECONDS,
  STATION_POLE,
  STATION_SUN,
  capStartDeg,
  groundLatitudeDeg,
  horizonDeg,
  orbitAngles,
  orbitSecondsFor,
  parseOrbit,
  parseStationDemo,
  poleYaw,
  startAngle,
  sunOverNadir,
} from "../src/render/stationspin";

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const IDS = Array.from({ length: 300 }, (_, i) => `${40000 + i * 7919}/${i % 6}`);

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

  it("the three speeds are 5, 2.5 and 1 minutes for a full trip round, slow to fast", () => {
    expect(ORBIT_TURN_SECONDS.A / 60).toBe(5);
    expect(ORBIT_TURN_SECONDS.B / 60).toBe(2.5);
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

describe("3o fix 2: the trip round", () => {
  it("a planet always starts at the same place; other planets start elsewhere; always within a few hours of noon", () => {
    for (const id of IDS) {
      expect(startAngle(id)).toBe(startAngle(id));
      expect(Math.abs(startAngle(id))).toBeLessThanOrEqual(STATION_START_SPREAD_DEG * DEG + 1e-9);
      expect(poleYaw(id)).toBeGreaterThanOrEqual(0);
      expect(poleYaw(id)).toBeLessThan(TWO_PI);
    }
    expect(new Set(IDS.map(startAngle)).size).toBeGreaterThan(250);
    expect(new Set(IDS.map(poleYaw)).size).toBeGreaterThan(250);
  });

  it("one full trip takes exactly the trip time, half a trip takes half", () => {
    const start = 0.4;
    expect(orbitAngles(0, 300, start)).toEqual({ elapsed: 0, angle: start });
    expect(orbitAngles(150, 300, start).elapsed).toBeCloseTo(Math.PI, 9);
    expect(orbitAngles(75, 300, start).angle - start).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.cos(orbitAngles(300, 300, start).angle)).toBeCloseTo(Math.cos(start), 9); // back where it began
    expect(Math.cos(orbitAngles(300 * 40 + 75, 300, start).elapsed)).toBeCloseTo(0, 6); // a long visit never goes wrong
  });

  it("the turn never jumps: a tiny step in time is a tiny step in angle, also across a full trip", () => {
    for (const t of [0, 149.99, 299.99, 600 - 0.01]) {
      const a = orbitAngles(t, 300, 0.3).angle;
      const b = orbitAngles(t + 0.02, 300, 0.3).angle;
      const d = Math.abs(Math.sin((b - a) / 2)) * 2; // the gap round the circle (a whole turn counts as no jump)
      expect(d).toBeLessThan(0.01);
    }
  });

  it("off (0 seconds) stands still at its start place, whatever the time", () => {
    for (const t of [0, 1, 99, 5000]) expect(orbitAngles(t, 0, 0.2)).toEqual({ elapsed: 0, angle: 0.2 });
  });
});

describe("3o fix 2: the ice caps are never at the slot", () => {
  it("the planet's pole and the sun are unit directions", () => {
    expect(Math.hypot(STATION_POLE.x, STATION_POLE.y, STATION_POLE.z)).toBeCloseTo(1, 9);
    expect(Math.hypot(STATION_SUN.x, STATION_SUN.y, STATION_SUN.z)).toBeCloseTo(1, 9);
  });

  it("the ground straight below never goes higher in latitude than the orbit's tilt, all the way round", () => {
    let top = 0;
    for (let a = 0; a < TWO_PI; a += 0.01) top = Math.max(top, Math.abs(groundLatitudeDeg(a)));
    expect(top).toBeLessThanOrEqual(STATION_ORBIT_INCLINATION_DEG + 0.01);
    expect(top).toBeGreaterThan(STATION_ORBIT_INCLINATION_DEG - 1); // and it does use the tilt (varied ground, not one band)
  });

  it("even the far edge of what can be seen from the bay stays clear of every ice cap (they start at 0.75 to 0.9 of the way to the pole)", () => {
    const seen = horizonDeg(DOCKED_STATION_PLANET_RADIUS, DOCKED_STATION_PLANET_ALTITUDE + 4); // from 4 units above the floor
    for (let caps = 0.75; caps <= 0.9001; caps += 0.01) {
      expect(STATION_ORBIT_INCLINATION_DEG + seen).toBeLessThan(capStartDeg(caps));
    }
  });
});

describe("3o fix 2: the light goes round with the planet", () => {
  it("the visit starts in daylight, every time", () => {
    for (const id of IDS) expect(sunOverNadir(startAngle(id))).toBeGreaterThan(0.35);
  });

  it("day and night come round once a trip: about half of the trip the sun is up over the ground below", () => {
    let lit = 0;
    let dark = 0;
    const n = 720;
    for (let i = 0; i < n; i++) {
      const s = sunOverNadir((i / n) * TWO_PI);
      if (s > 0) lit++;
      else dark++;
    }
    expect(dark).toBeGreaterThan(0);
    expect(lit / n).toBeGreaterThan(0.45);
    expect(lit / n).toBeLessThan(0.55);
  });
});
