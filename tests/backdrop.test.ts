import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { makeBackdrop, reseedBackdrop } from "../src/render/backdrop";
import { starfieldPositions, systemSkySeed } from "../src/render/helpers";

// Stage G5a step 4: the dots object a screen keeps, and how it takes the pattern of another system.

const positions = (p: THREE.Points): Float32Array => (p.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
const same = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);

describe("the background dots a screen keeps", () => {
  it("start with the default pattern (the one every screen had before)", () => {
    expect(same(positions(makeBackdrop(260, 450)), starfieldPositions(260, 450))).toBe(true);
  });

  it("can start with the pattern of a system", () => {
    expect(same(positions(makeBackdrop(260, 450, 42)), starfieldPositions(260, 450, systemSkySeed(42)))).toBe(true);
  });

  it("take the pattern of another system in place, and tell the graphics card", () => {
    const dots = makeBackdrop(260, 450);
    const attribute = dots.geometry.getAttribute("position") as THREE.BufferAttribute;
    const before = attribute.version;
    reseedBackdrop(dots, 260, 450, 9);
    expect(same(positions(dots), starfieldPositions(260, 450, systemSkySeed(9)))).toBe(true);
    expect(attribute.version > before).toBe(true);
  });

  it("do nothing when the system is the same, and can return to the default pattern", () => {
    const dots = makeBackdrop(260, 450);
    reseedBackdrop(dots, 260, 450, 9);
    const attribute = dots.geometry.getAttribute("position") as THREE.BufferAttribute;
    const version = attribute.version;
    reseedBackdrop(dots, 260, 450, 9);
    expect(attribute.version).toBe(version);
    reseedBackdrop(dots, 260, 450, null);
    expect(same(positions(dots), starfieldPositions(260, 450))).toBe(true);
  });

  it("two systems one after the other give each its own pattern, and the first one again gives the first back", () => {
    const dots = makeBackdrop(260, 450);
    reseedBackdrop(dots, 260, 450, 100);
    const a = Array.from(positions(dots));
    reseedBackdrop(dots, 260, 450, 200);
    const b = Array.from(positions(dots));
    reseedBackdrop(dots, 260, 450, 100);
    expect(same(a, b)).toBe(false);
    expect(same(a, positions(dots))).toBe(true);
  });
});
