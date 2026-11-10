import { describe, expect, it } from "vitest";
import { cockpitRoomVisible, dragLook, glide, isDoubleTap, isTap, ownShipVisible, pilotEye, renderPathFor, fovForMagnification, shakeShare, startFov, zoomMagnification } from "../src/render/cockpitview";

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

describe("cockpit view: looking around, zooming, shaking", () => {
  const limits = { yawMax: 1.5, pitchMin: -0.6, pitchMax: 1 };
  it("dragging turns the head and stays inside the limits", () => {
    expect(dragLook({ yaw: 0, pitch: 0 }, 100, 0, 0.005, limits).yaw).toBeCloseTo(0.5, 6);
    expect(dragLook({ yaw: 0, pitch: 0 }, 0, 100, 0.005, limits).pitch).toBeCloseTo(0.5, 6);
    expect(dragLook({ yaw: 1.4, pitch: 0.9 }, 1000, 1000, 0.01, limits)).toEqual({ yaw: 1.5, pitch: 1 });
    expect(dragLook({ yaw: -1.4, pitch: -0.5 }, -1000, -1000, 0.01, limits)).toEqual({ yaw: -1.5, pitch: -0.6 });
  });
  it("zoom stays between one fifth and five times the start view", () => {
    expect(zoomMagnification(1, 0.5, 5)).toBe(2);
    expect(zoomMagnification(1, 2, 5)).toBe(0.5);
    expect(zoomMagnification(4, 0.1, 5)).toBe(5);
    expect(zoomMagnification(0.3, 10, 5)).toBe(0.2);
  });
  it("magnification 1 keeps the view, 2 makes things twice as big", () => {
    expect(fovForMagnification(90, 1)).toBeCloseTo(90, 6);
    const half = (f: number) => Math.tan((f * Math.PI) / 360);
    expect(half(fovForMagnification(90, 2))).toBeCloseTo(half(90) / 2, 6);
    expect(half(fovForMagnification(90, 0.5))).toBeCloseTo(half(90) * 2, 6);
  });
  it("the start view is the approved 70 degrees zoomed out 1.75 times, wider than before", () => {
    const f = startFov(70, 1.75);
    expect(f).toBeGreaterThan(70);
    expect(Math.tan((f * Math.PI) / 360)).toBeCloseTo(Math.tan((70 * Math.PI) / 360) * 1.75, 6);
  });
  it("the view is never wider than the cap", () => {
    expect(fovForMagnification(100, 0.2, 150)).toBe(150);
  });
  it("the cockpit shakes less than the orbit camera", () => {
    expect(shakeShare("orbit", 0.2)).toBe(1);
    expect(shakeShare("cockpit", 0.2)).toBe(0.2);
  });
});

describe("cockpit view: double tap", () => {
  it("two quick taps are a double tap, slow ones or the first one are not", () => {
    expect(isDoubleTap(1000, 1200)).toBe(true);
    expect(isDoubleTap(1000, 1500)).toBe(false);
    expect(isDoubleTap(0, 100)).toBe(false);
  });
  it("a press that barely moved is a tap, a drag is not", () => {
    expect(isTap(3)).toBe(true);
    expect(isTap(40)).toBe(false);
  });
});

describe("cockpit view: gliding back to centre", () => {
  it("moves toward the target without jumping", () => {
    const one = glide(1, 0, 1 / 60);
    expect(one).toBeLessThan(1);
    expect(one).toBeGreaterThan(0.5); // one frame covers only a small part
  });
  it("gets most of the way in about a quarter of a second and never overshoots", () => {
    let v = 1;
    for (let i = 0; i < 15; i++) v = glide(v, 0, 1 / 60);
    expect(v).toBeLessThan(0.3);
    expect(v).toBeGreaterThanOrEqual(0);
  });
  it("arrives exactly and works from the other side", () => {
    let v = -1;
    for (let i = 0; i < 300; i++) v = glide(v, 0, 1 / 60);
    expect(v).toBe(0);
    expect(glide(0, 5, 0)).toBe(0);
  });
});
