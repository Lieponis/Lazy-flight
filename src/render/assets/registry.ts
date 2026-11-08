// THE REGISTRY: every ship, outpost and station design the game may use.
// Rule: if an asset is not here AND in docs/ASSET-CATALOG.md, the game does not use it.
//
// How other code uses it:
//   import { getAsset } from "./assets/registry";
//   const model = getAsset("cargo-hauler").build({ variant: 0, tint: 0xff8844 });
//   scene.add(model.group);              // the model
//   model.anchors.parking.pos            // a named point
//   model.update(seconds);               // blinking lights and spinning ring, every frame
//
// Stage S1: the three ships. Outposts come in S2, stations in S3.

import { buildCargoHauler, buildPassengerLiner, buildScout } from "./ships";
import type { AssetEntry, AssetKind } from "./types";

const SHIP_ANCHORS_TWIN = ["parking", "eye", "nose", "engineL", "engineR"] as const;

export const ASSETS: readonly AssetEntry[] = [
  {
    id: "cargo-hauler",
    name: "Cargo Hauler",
    kind: "ship",
    description: "Wide, flat hauler with a big multi-pane cockpit, cargo hidden inside and two engine pods.",
    variants: 1,
    build: buildCargoHauler,
    anchorNames: SHIP_ANCHORS_TWIN,
    triangles: 568,
    status: "DRAFT",
  },
  {
    id: "passenger-liner",
    name: "Passenger Liner",
    kind: "ship",
    description: "Long, grand white liner with a raised top deck, a row of lit windows each side and a wide engine bank.",
    variants: 1,
    build: buildPassengerLiner,
    anchorNames: SHIP_ANCHORS_TWIN,
    triangles: 684,
    status: "DRAFT",
  },
  {
    id: "scout",
    name: "Scout",
    kind: "ship",
    description: "Small, angular grey explorer with two dark side pods, short swept fins and one big engine.",
    variants: 1,
    build: buildScout,
    anchorNames: ["parking", "eye", "nose", "engineMain"],
    triangles: 540,
    status: "DRAFT",
  },
];

export function getAsset(id: string): AssetEntry {
  const entry = ASSETS.find((a) => a.id === id);
  if (!entry) throw new Error(`Unknown asset: ${id}`);
  return entry;
}

export function findAsset(id: string): AssetEntry | undefined {
  return ASSETS.find((a) => a.id === id);
}

export function listAssets(kind?: AssetKind): AssetEntry[] {
  return ASSETS.filter((a) => !kind || a.kind === kind);
}
