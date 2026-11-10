import { describe, expect, it } from "vitest";
import { cockpitRoomVisible, ownShipVisible, pilotEye, renderPathFor } from "../src/render/cockpitview";

describe("cockpit view: what is drawn and how", () => {
  it("cockpit view goes through the lens, orbit view is the normal picture", () => {
    expect(renderPathFor("cockpit")).toBe("lens");
    expect(renderPathFor("orbit")).toBe("flat");
  });
  it("the room shows only in cockpit view and your own ship only in orbit view", () => {
    expect(cockpitRoomVisible("cockpit")).toBe(true);
    expect(cockpitRoomVisible("orbit")).toBe(false);
    expect(ownShipVisible("cockpit")).toBe(false);
    expect(ownShipVisible("orbit")).toBe(true);
  });
  it("never shows the room and the ship at the same time", () => {
    for (const mode of ["orbit", "cockpit"] as const) {
      expect(cockpitRoomVisible(mode) && ownShipVisible(mode)).toBe(false);
    }
  });
  it("the pilot's eye is the ship's eye spot, moving with the ship's bob", () => {
    expect(pilotEye({ x: 0.1, y: 0.5, z: -0.3 }, 0.04)).toEqual({ x: 0.1, y: 0.54, z: -0.3 });
  });
  it("a ship without an eye spot still gets a sensible one", () => {
    const e = pilotEye(undefined, 0);
    expect(e.x).toBe(0);
    expect(e.y).toBeCloseTo(0.45, 6);
    expect(e.z).toBeCloseTo(-0.4, 6);
  });
});
