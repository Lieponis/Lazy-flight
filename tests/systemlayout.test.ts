import { describe, expect, it } from "vitest";
import { ballTriangles, fitDistance, orbitRadii, planetDetail, planetFootprint, stationOrbitFor, systemSummary } from "../src/render/systemlayout";
import { markParts, parseMarks, parseSystemPreview, previewList } from "../src/render/systemmarks";

describe("system layout: orbit spacing", () => {
  it("every orbit is wider than the one before and footprints never touch", () => {
    const fp = [1.2, 3, 1.1, 1.4, 2.6, 1.2, 1.2, 1.5, 1.2, 1.2];
    const r = orbitRadii(fp, 1.8);
    for (let i = 1; i < r.length; i++) {
      expect(r[i]! - r[i - 1]!).toBeGreaterThanOrEqual(fp[i]! + fp[i - 1]!);
    }
    expect(r[0]!).toBeGreaterThanOrEqual(4.2);
  });
  it("big planets get more room than small ones", () => {
    const small = orbitRadii([1, 1, 1], 1.5);
    const big = orbitRadii([1, 3, 1], 1.5);
    expect(big[2]!).toBeGreaterThan(small[2]!);
  });
  it("10 ordinary planets stay compact", () => {
    const r = orbitRadii(new Array(10).fill(1.3), 1.8);
    expect(r[9]!).toBeLessThan(40);
  });
  it("one planet works", () => {
    expect(orbitRadii([1.2], 1.8)).toHaveLength(1);
    expect(orbitRadii([], 1.8)).toEqual([]);
  });
  it("a station or rings widen the footprint", () => {
    expect(planetFootprint(1, true)).toBeGreaterThan(planetFootprint(1, false));
    expect(planetFootprint(1, false, 2.4)).toBeGreaterThan(planetFootprint(1, false));
    expect(planetFootprint(2.4, true)).toBeGreaterThan(stationOrbitFor(2.4));
  });
});

describe("system layout: camera and detail", () => {
  it("the camera stands further away for a bigger system, and in a narrower window", () => {
    expect(fitDistance(40, 50, 16 / 9, 0.6)).toBeGreaterThan(fitDistance(10, 50, 16 / 9, 0.6));
    expect(fitDistance(30, 50, 0.6, 0.6)).toBeGreaterThan(fitDistance(30, 50, 16 / 9, 0.6));
  });
  it("the whole system fits: the farthest planet is inside the picture", () => {
    const outer = 36;
    const d = fitDistance(outer, 50, 16 / 9, 0.6);
    const halfH = Math.tan((50 * Math.PI) / 360) * (16 / 9);
    expect(outer / d).toBeLessThan(halfH);
  });
  it("crowded systems use lighter balls, 10 planets stay far below the budget", () => {
    expect(planetDetail(10, false)).toBeLessThan(planetDetail(4, false));
    expect(planetDetail(10, true)).toBeLessThan(planetDetail(4, true));
    expect(ballTriangles(2)).toBe(180);
    expect(ballTriangles(1)).toBe(80);
    const worst = 10 * ballTriangles(planetDetail(10, true)) * 2 + 80; // all gas giants with clouds, a very unlikely worst case
    expect(worst).toBeLessThan(5000);
  });
});

describe("system layout: summary text and test links", () => {
  it("one dock still reads sensibly", () => {
    const text = systemSummary(1, [{ name: "Foo Hub", kind: "Station" }]);
    expect(text).toContain("1 planet, 1 dock: Foo Hub (Station)");
  });
  it("lists every dock", () => {
    const text = systemSummary(10, [{ name: "A", kind: "Outpost" }, { name: "B", kind: "Station" }, { name: "C", kind: "Outpost" }]);
    expect(text).toContain("10 planets, 3 docks");
    for (const n of ["A (Outpost)", "B (Station)", "C (Outpost)"]) expect(text).toContain(n);
  });
  it("?marks= picks a style and the parts follow", () => {
    expect(parseMarks("?marks=a")).toBe("A");
    expect(parseMarks("?marks=off")).toBe("off");
    expect(parseMarks("?marks=Z")).toBe(null);
    expect(markParts("A")).toEqual({ lanes: true });
    expect(markParts("off").lanes).toBe(false);
  });
  it("?systempreview=1 opens the buttons unless 0 or false", () => {
    expect(parseSystemPreview("?systempreview=1")).toBe(true);
    expect(parseSystemPreview("?systempreview=0")).toBe(false);
    expect(parseSystemPreview("")).toBe(false);
  });
  it("the preview list has at most two systems per planet count, fewest planets first", () => {
    const systems = [3, 10, 10, 10, 1, 3, 3, 5].map((planetCount, i) => ({ planetCount, i }));
    const list = previewList(systems, 2);
    expect(list.map((s) => s.planetCount)).toEqual([1, 3, 3, 5, 10, 10]);
  });
});
