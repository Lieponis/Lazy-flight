// Builds Agent 8's designs for the screens. Every call builds a FRESH model: the screen that asks owns it
// and must throw it away with disposeAll() when it is done (so memory does not grow).

import * as THREE from "three";
import type { Planet } from "../universe";
import { getAsset, type AssetModel } from "./assets";
import { hexToNumber } from "./helpers";
import { outpostModelFor, resolveShipId, stationModelFor, type DockKind } from "./integration";

/**
 * The ship design for a ship id (unknown ids give the Cargo Hauler). Flames start short (parked).
 * `liveryId` is a paint job id like "rescue-red" (see liveriesFor in ./assets); missing or unknown = the standard paint.
 */
export function buildShipModel(shipId: string, liveryId?: string): AssetModel {
  return getAsset(resolveShipId(shipId)).build(liveryId ? { livery: liveryId } : undefined);
}

export interface DockModel {
  id: string;
  kind: DockKind;
  model: AssetModel;
  /** The model's own `parking` anchor position (where the ship rests). */
  parking: THREE.Vector3;
}

/** The outpost or station design picked for this dock. Outposts get the planet's main colour on their ground and dust. */
export function buildDockModel(kind: DockKind, dockId: string, planet: Planet): DockModel {
  const id = kind === "OUTPOST" ? outpostModelFor(dockId, planet.type) : stationModelFor(dockId);
  const model = getAsset(id).build({ tint: hexToNumber(planet.colors.primary) });
  const parking = model.anchors.parking?.pos.clone() ?? new THREE.Vector3();
  return { id, kind, model, parking };
}

/** Moves the model so that its parking anchor sits at the origin of its parent. */
export function parkAtOrigin(dock: DockModel): void {
  dock.model.group.position.copy(dock.parking).negate();
}

/** How big the ship is for the camera: the radius of a ball that holds (nearly) all of it. Used to keep the ship in the picture. */
export function shipRadius(model: AssetModel): number {
  const size = new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3());
  return Math.max(1, 0.5 * Math.hypot(size.x, size.y, size.z) * 0.85);
}
