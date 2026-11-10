import { describe, expect, it } from "vitest";
import { parseWarpPreview, parseWarpStyle, warpIntensity, warpPalette, warpPulse, warpStreakData } from "../src/render/warpmath";

describe("warp: looks and test links", () => {
  it("?warp= picks A, B or C (any case) and nothing else", () => {
    expect(parseWarpStyle("?warp=A")).toBe("A");
    expect(parseWarpStyle("?speed=60&warp=c")).toBe("C");
    expect(parseWarpStyle("?warp=Z")).toBe(null);
    expect(parseWarpStyle("")).toBe(null);
  });
  it("?warppreview opens the preview unless it is 0 or false", () => {
    expect(parseWarpPreview("?warppreview=1")).toBe(true);
    expect(parseWarpPreview("?warppreview")).toBe(true);
    expect(parseWarpPreview("?warppreview=0")).toBe(false);
    expect(parseWarpPreview("?warppreview=false")).toBe(false);
    expect(parseWarpPreview("?speed=5")).toBe(false);
  });
});

describe("warp: colours that drift slowly", () => {
  it("always stays in blue, purple and violet", () => {
    for (let t = 0; t < 3000; t += 7) {
      const [a, b, c] = warpPalette(t);
      for (const col of [a, b, c]) {
        expect(col.h).toBeGreaterThan(0.55);
        expect(col.h).toBeLessThan(0.86);
        expect(col.l).toBeGreaterThan(0.35);
        expect(col.l).toBeLessThan(0.75);
      }
    }
  });
  it("the three colours are different from each other", () => {
    const [a, b, c] = warpPalette(100);
    expect(a.h).toBeLessThan(b.h);
    expect(b.h).toBeLessThan(c.h);
  });
  it("changes slowly: over one second a colour barely moves", () => {
    for (let t = 0; t < 600; t += 13) {
      const x = warpPalette(t);
      const y = warpPalette(t + 1);
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(x[i]!.h - y[i]!.h)).toBeLessThan(0.01);
        expect(Math.abs(x[i]!.l - y[i]!.l)).toBeLessThan(0.02);
      }
    }
  });
  it("does change over a minute or so (it is not frozen)", () => {
    const a = warpPalette(0)[0].h;
    let moved = false;
    for (let t = 5; t < 120; t += 5) if (Math.abs(warpPalette(t)[0].h - a) > 0.01) moved = true;
    expect(moved).toBe(true);
  });
  it("the glow swells between 0.75 and 1", () => {
    for (let t = 0; t < 400; t += 3) {
      expect(warpIntensity(t)).toBeGreaterThanOrEqual(0.75);
      expect(warpIntensity(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe("warp: surges", () => {
  it("stay between 0 and 1, and come about once every period", () => {
    let surges = 0;
    let inside = false;
    for (let t = 0; t < 250; t += 0.1) {
      const p = warpPulse(t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      if (p > 0.5 && !inside) surges++;
      inside = p > 0.5;
    }
    expect(surges).toBeGreaterThanOrEqual(9);
    expect(surges).toBeLessThanOrEqual(11);
  });
  it("start and end smoothly (no jump between two moments close together)", () => {
    for (let t = 0; t < 200; t += 0.05) expect(Math.abs(warpPulse(t + 0.05) - warpPulse(t))).toBeLessThan(0.1);
  });
  it("happen at a different moment in each round", () => {
    const peak = (round: number): number => {
      let best = 0;
      let at = 0;
      for (let t = round * 25; t < round * 25 + 25; t += 0.1) {
        const p = warpPulse(t);
        if (p > best) {
          best = p;
          at = t - round * 25;
        }
      }
      return Math.round(at);
    };
    const peaks = new Set([0, 1, 2, 3, 4, 5].map(peak));
    expect(peaks.size).toBeGreaterThan(2);
  });
});

describe("warp: the stars", () => {
  const d = warpStreakData(500, 160, 2, 20);
  it("makes the same stars every time", () => {
    const e = warpStreakData(500, 160, 2, 20);
    expect(Array.from(e.positions.slice(0, 30))).toEqual(Array.from(d.positions.slice(0, 30)));
  });
  it("has the right amount of everything for every end of every star", () => {
    expect(d.positions.length).toBe(500 * 6);
    expect(d.end.length).toBe(1000);
    expect(d.speed.length).toBe(1000);
    expect(d.length.length).toBe(1000);
    expect(d.tint.length).toBe(1000);
    expect(d.bright.length).toBe(1000);
    for (let i = 0; i < 500; i++) {
      expect(d.end[i * 2]).toBe(0);
      expect(d.end[i * 2 + 1]).toBe(1);
    }
  });
  it("keeps the dark gap in the middle and stays inside the tunnel", () => {
    for (let i = 0; i < 500; i++) {
      const r = Math.hypot(d.positions[i * 6]!, d.positions[i * 6 + 1]!);
      expect(r).toBeGreaterThanOrEqual(2 - 1e-5);
      expect(r).toBeLessThanOrEqual(20 + 1e-5);
      expect(d.positions[i * 6 + 2]).toBeGreaterThanOrEqual(0);
      expect(d.positions[i * 6 + 2]).toBeLessThan(160);
    }
  });
  it("has trails of very different lengths and speeds: many short, a few long", () => {
    const lens = Array.from({ length: 500 }, (_, i) => d.length[i * 2]!).sort((a, b) => a - b);
    expect(lens[0]).toBeLessThan(1);
    expect(lens[499]).toBeGreaterThan(15);
    expect(lens[250]).toBeLessThan(4);
    const speeds = Array.from({ length: 500 }, (_, i) => d.speed[i * 2]!);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(0.7);
  });
  it("spreads the stars over all three colours", () => {
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let i = 0; i < 500; i++) {
      const t = d.tint[i * 2]!;
      if (t < 0.33) low++;
      else if (t < 0.66) mid++;
      else high++;
    }
    expect(low).toBeGreaterThan(100);
    expect(mid).toBeGreaterThan(100);
    expect(high).toBeGreaterThan(100);
  });
});
