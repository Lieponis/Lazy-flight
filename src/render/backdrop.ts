// The plain background dots behind a screen (system view, flight, docked, floating, models page).
// Plain words: every system has its own pattern of dots, the same every time, so flying to another system changes the sky a little.
// Decoration only: nothing in the game reads these dots. A screen makes the dots once and gives them a new pattern when its system changes.

import * as THREE from "three";
import { systemSkySeed, starfieldPositions } from "./helpers";

/** Dots in the colour the game has always used. `systemId` null = the one pattern all screens had before. */
export function makeBackdrop(count: number, radius: number, systemId: number | null = null): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(count, radius, seedFor(systemId)), 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false }));
  points.userData.skySystem = systemId;
  return points;
}

/** Gives the dots the pattern of another system (null = the default pattern). Same system again = nothing to do. */
export function reseedBackdrop(points: THREE.Points, count: number, radius: number, systemId: number | null): void {
  if (points.userData.skySystem === systemId) return;
  const attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  attribute.array.set(starfieldPositions(count, radius, seedFor(systemId)));
  attribute.needsUpdate = true;
  points.userData.skySystem = systemId;
}

function seedFor(systemId: number | null): number | undefined {
  return systemId === null ? undefined : systemSkySeed(systemId);
}
