import { describe, expect, it } from "vitest";
import { paniniDir, paniniX } from "../src/render/assets/lens";

describe("cockpit lens (Panini)", () => {
  it("sends a screen point back to the view direction it came from", () => {
    for (const d of [0, 0.35, 1]) {
      for (const deg of [-40, -20, 0, 10, 35]) {
        const phi = (deg * Math.PI) / 180;
        const [x, , z] = paniniDir(paniniX(phi, d), 0, d);
        expect(Math.atan2(x, z)).toBeCloseTo(phi, 6);
      }
    }
  });
  it("with strength 0 is a normal flat picture", () => {
    const phi = 0.5;
    expect(paniniX(phi, 0)).toBeCloseTo(Math.tan(phi), 6);
  });
});
