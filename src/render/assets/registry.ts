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
// Empty for now: the style guide (stage S0) is approved first. Ships come in S1, outposts in S2, stations in S3.

import type { AssetEntry, AssetKind } from "./types";

export const ASSETS: readonly AssetEntry[] = [];

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
