// The map camera follows the finger softly (NAV-2, after Andy's video: the whole picture shook while he turned the map).
// Pure parts only: the easing step, the address word, and the orbit view with a pretend finger.

import { describe, expect, it } from "vitest";
import { OrbitView, smoothTurn } from "../src/render/input";
import { parseMapTurn } from "../src/render/routemath";

/** A pretend page element that remembers the finger handlers the view hangs on it. */
function fakeElement() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const el = {
    style: {} as Record<string, string>,
    addEventListener: (name: string, fn: (e: unknown) => void) => {
      handlers[name] = fn;
    },
    removeEventListener: () => {},
    setPointerCapture: () => {},
  };
  return { el, handlers };
}

function makeView(smooth: number) {
  const { el, handlers } = fakeElement();
  const camera = {} as never;
  const view = new OrbitView(camera, el as unknown as HTMLElement, 1, 100, 50);
  view.turnSmoothSeconds = smooth;
  view.attach();
  const finger = (type: "pointerdown" | "pointermove", x: number, y: number) => handlers[type]!({ pointerId: 1, clientX: x, clientY: y });
  return { view, finger };
}

describe("smoothTurn", () => {
  it("turns at once when the easing time is 0", () => {
    expect(smoothTurn(0.3, 0.016, 0)).toEqual({ step: 0.3, rest: 0 });
  });

  it("takes only part of the turn in one frame, and the parts add up to the whole turn", () => {
    let rest = 1;
    let sum = 0;
    for (let i = 0; i < 200; i++) {
      const t = smoothTurn(rest, 1 / 60, 0.06);
      expect(Math.abs(t.step)).toBeLessThanOrEqual(Math.abs(rest));
      sum += t.step;
      rest = t.rest;
    }
    expect(rest).toBe(0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("first step is a share of the turn, not all of it", () => {
    const t = smoothTurn(1, 1 / 60, 0.06);
    expect(t.step).toBeGreaterThan(0.2);
    expect(t.step).toBeLessThan(0.3);
  });

  it("does not depend on the frame rate", () => {
    const one = smoothTurn(1, 1 / 30, 0.06);
    const a = smoothTurn(1, 1 / 60, 0.06);
    const b = smoothTurn(a.rest, 1 / 60, 0.06);
    expect(one.rest).toBeCloseTo(b.rest, 9);
  });

  it("works both ways and ignores a frame of zero or negative time", () => {
    expect(smoothTurn(-1, 1 / 60, 0.06).step).toBeLessThan(0);
    expect(smoothTurn(1, 0, 0.06)).toEqual({ step: 0, rest: 1 });
    expect(smoothTurn(1, -5, 0.06)).toEqual({ step: 0, rest: 1 });
  });
});

describe("parseMapTurn", () => {
  it("reads milliseconds from the address", () => {
    expect(parseMapTurn("?mapturn=60")).toBe(60);
    expect(parseMapTurn("?a=1&mapturn=120")).toBe(120);
    expect(parseMapTurn("?mapturn=0")).toBe(0);
  });

  it("keeps the number in range, and gives null when it is missing or not a number", () => {
    expect(parseMapTurn("?mapturn=9999")).toBe(400);
    expect(parseMapTurn("?mapturn=-5")).toBe(0);
    expect(parseMapTurn("?mapturn=12.6")).toBe(13);
    expect(parseMapTurn("")).toBeNull();
    expect(parseMapTurn("?mapturn=")).toBeNull();
    expect(parseMapTurn("?mapturn=soft")).toBeNull();
  });
});

describe("OrbitView with an easing time", () => {
  it("with 0 it follows the finger at once, as before", () => {
    const { view, finger } = makeView(0);
    const y0 = view.yaw;
    finger("pointerdown", 100, 100);
    finger("pointermove", 110, 100);
    expect(view.yaw).toBeCloseTo(y0 - 0.1, 9);
  });

  it("with an easing time the first move does not turn the camera yet, the frames after it do", () => {
    const { view, finger } = makeView(0.06);
    const y0 = view.yaw;
    finger("pointerdown", 100, 100);
    finger("pointermove", 110, 100);
    expect(view.yaw).toBe(y0);
    view.glide(1 / 60);
    expect(view.yaw).toBeLessThan(y0);
    expect(view.yaw).toBeGreaterThan(y0 - 0.1);
  });

  it("ends at the same place as turning at once (nothing is lost, nothing is added)", () => {
    const soft = makeView(0.06);
    const hard = makeView(0);
    const moves: Array<[number, number]> = [
      [100, 100],
      [108, 103],
      [111, 101],
      [125, 99],
      [124, 110],
    ];
    soft.finger("pointerdown", 100, 100);
    hard.finger("pointerdown", 100, 100);
    for (const [x, y] of moves) {
      soft.finger("pointermove", x, y);
      hard.finger("pointermove", x, y);
      soft.view.glide(1 / 60);
    }
    for (let i = 0; i < 120; i++) soft.view.glide(1 / 60);
    expect(soft.view.yaw).toBeCloseTo(hard.view.yaw, 6);
    expect(soft.view.pitch).toBeCloseTo(hard.view.pitch, 6);
  });

  it("evens out a finger that jumps: the camera never turns back against the way the finger is going", () => {
    const { view, finger } = makeView(0.06);
    finger("pointerdown", 200, 100);
    let last = view.yaw;
    let x = 200;
    const jumps = [3, 0, 5, 0, 4, 1, 6, 0, 3, 4]; // pixels per frame, uneven but never backwards
    for (const j of jumps) {
      x -= j;
      finger("pointermove", x, 100);
      view.glide(1 / 60);
      expect(view.yaw).toBeGreaterThanOrEqual(last);
      last = view.yaw;
    }
  });

  it("stops at the top and bottom, and does not keep a turn it cannot make", () => {
    const { view, finger } = makeView(0.06);
    finger("pointerdown", 100, 100);
    finger("pointermove", 100, 900); // a long drag down: pitch wants to go far past 1.4
    for (let i = 0; i < 200; i++) view.glide(1 / 60);
    expect(view.pitch).toBe(1.4);
    // a small drag back up turns at once away from the stop (nothing was stored up)
    finger("pointermove", 100, 890);
    view.glide(1 / 60);
    expect(view.pitch).toBeLessThan(1.4);
  });

  it("leaving the screen drops a turn that has not been made yet", () => {
    const { view, finger } = makeView(0.06);
    finger("pointerdown", 100, 100);
    finger("pointermove", 140, 100);
    view.detach();
    const y = view.yaw;
    view.glide(1 / 60);
    expect(view.yaw).toBe(y);
  });
});
