// THE COCKPIT VIEW, the small decisions (pure logic, no Three.js, so it can be tested).
// Cockpit view draws the room through the cockpit lens (no stretched edges); Orbit view draws the normal way.

import type { Vec3 } from "./integration";

export type ViewMode = "orbit" | "cockpit";
/** "flat" = the normal picture, "lens" = through the cockpit lens. */
export type RenderPath = "flat" | "lens";

export function renderPathFor(mode: ViewMode): RenderPath {
  return mode === "cockpit" ? "lens" : "flat";
}

/** The room is only drawn in cockpit view; the player's own ship is only drawn in orbit view (never both). */
export function cockpitRoomVisible(mode: ViewMode): boolean {
  return mode === "cockpit";
}
export function ownShipVisible(mode: ViewMode): boolean {
  return mode === "orbit";
}

/** Where the pilot's eye is (and so where the room goes): the ship's eye spot, moving up and down with the ship's gentle bob. */
export function pilotEye(eye: Vec3 | undefined, shipY: number): Vec3 {
  return { x: eye?.x ?? 0, y: (eye?.y ?? 0.45) + shipY, z: eye?.z ?? -0.4 };
}
