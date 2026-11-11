import { describe, expect, it } from "vitest";
import { listSystemsNear } from "../src/universe";
import { floatCandidates } from "../src/render/floatpick";
import { buildShipModel } from "../src/render/models3d";
import { liveriesFor } from "../src/render/assets";

describe("float preview picks", () => {
  const seed = 12345;
  const systems = listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 40);
  it("finds planets without a dock, the same every time", () => {
    const a = floatCandidates(seed, systems, 3);
    const b = floatCandidates(seed, systems, 3);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
  it("never repeats a planet", () => {
    const ids = floatCandidates(seed, systems, 3).map((c) => c.planetId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("liveries through buildShipModel", () => {
  for (const ship of ["cargo-hauler", "passenger-liner", "scout"]) {
    it(`every paint job of ${ship} builds`, () => {
      const ids = liveriesFor(ship).map((l) => l.id);
      expect(ids.length).toBeGreaterThan(1);
      for (const id of ids) expect(buildShipModel(ship, id).group).toBeTruthy();
      expect(buildShipModel(ship, "no-such-paint").group).toBeTruthy();
      expect(buildShipModel(ship).group).toBeTruthy();
    });
  }
});
