import { describe, expect, it } from "vitest";
import { bayer4, flameFlicker, lookActive, lookPreset, parseLook, parseLookPreview, parseWobble, quantize, stepped, wobbleGrid } from "../src/render/lookmath";

describe("pixel look: test links", () => {
  it("?look= picks A, B, C or off", () => {
    expect(parseLook("?look=a")).toBe("A");
    expect(parseLook("?x=1&look=C")).toBe("C");
    expect(parseLook("?look=off")).toBe("off");
    expect(parseLook("?look=Z")).toBe(null);
    expect(parseLook("")).toBe(null);
  });
  it("?wobble= is a number from 0 to 1", () => {
    expect(parseWobble("?wobble=0.5")).toBe(0.5);
    expect(parseWobble("?wobble=7")).toBe(1);
    expect(parseWobble("")).toBe(null);
  });
  it("?lookpreview=1 opens the buttons unless it is 0 or false", () => {
    expect(parseLookPreview("?lookpreview=1")).toBe(true);
    expect(parseLookPreview("?lookpreview=0")).toBe(false);
    expect(parseLookPreview("")).toBe(false);
  });
});

describe("pixel look: strengths", () => {
  it("off does nothing and costs nothing", () => {
    expect(lookActive(lookPreset("off"))).toBe(false);
  });
  it("A, B, C get stronger: fewer colour bands, more grain", () => {
    const a = lookPreset("A");
    const b = lookPreset("B");
    const c = lookPreset("C");
    expect(a.bands).toBeGreaterThan(b.bands);
    expect(b.bands).toBeGreaterThan(c.bands);
    expect(a.grain).toBeLessThanOrEqual(b.grain);
    expect(b.grain).toBeLessThan(c.grain);
    for (const s of [a, b, c]) {
      expect(lookActive(s)).toBe(true);
      expect(s.wobble).toBe(0); // wobble is a separate switch, off by default
    }
  });
});

describe("pixel look: colour steps and dither", () => {
  it("the checker pattern has 16 different fair values", () => {
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(Math.round(bayer4(x, y) * 32));
    expect(seen.size).toBe(16);
    for (const v of seen) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(32);
    }
  });
  it("black and white stay black and white", () => {
    for (const b of [4, 12, 24, 48]) {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          expect(quantize(0, b, bayer4(x, y), 1)).toBe(0);
          expect(quantize(1, b, bayer4(x, y), 1)).toBe(1);
        }
      }
    }
  });
  it("only `bands` different shades come out", () => {
    const out = new Set<number>();
    for (let i = 0; i <= 200; i++) out.add(Math.round(quantize(i / 200, 8, bayer4(i % 4, 1), 1) * 1000));
    expect(out.size).toBe(8);
  });
  it("dither spreads a flat in-between shade over two neighbouring bands, on average keeping its brightness", () => {
    let sum = 0;
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const q = quantize(0.43, 4, bayer4(x, y), 1);
        seen.add(Math.round(q * 1000));
        sum += q;
      }
    }
    expect(seen.size).toBe(2);
    expect(Math.abs(sum / 16 - 0.43)).toBeLessThan(0.05);
  });
  it("without dither it is plain rounding", () => {
    expect(quantize(0.43, 4, 0.9, 0)).toBeCloseTo(1 / 3, 6);
    expect(quantize(0.6, 4, 0.1, 0)).toBeCloseTo(2 / 3, 6);
  });
});

describe("pixel look: flames, flash, wobble", () => {
  it("stepped gives chunky steps, and 0 steps leaves the number alone", () => {
    expect(stepped(0.37, 0)).toBe(0.37);
    expect(stepped(0.37, 4)).toBe(0.25);
    expect(stepped(0, 6)).toBe(0);
    expect(stepped(1, 6)).toBe(1);
  });
  it("the flame flickers between three sizes, in steps, and 0 amount is steady", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(Math.round(flameFlicker(i / 20, 0.12) * 1000));
    expect(seen.size).toBe(3);
    expect(flameFlicker(1.234, 0)).toBe(1);
    expect(flameFlicker(0.51, 0.12)).toBe(flameFlicker(0.55, 0.12)); // same step
  });
  it("wobble 0 means no visible snapping, more wobble means a coarser grid", () => {
    expect(wobbleGrid(320, 180, 0).x).toBeGreaterThan(10000);
    expect(wobbleGrid(320, 180, 0.5).x).toBeLessThan(wobbleGrid(320, 180, 0.2).x);
    expect(wobbleGrid(320, 180, 1).x).toBeLessThan(320);
  });
});
