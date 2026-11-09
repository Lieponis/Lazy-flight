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
// Stage S1: the three ships. Stage S2: the four outposts. Stage S3: the four stations.

import { buildOutpostComms, buildOutpostDepot, buildOutpostDomes, buildOutpostHub } from "./outposts";
import { buildStationCargo, buildStationRefinery, buildStationRing, buildStationStarport } from "./stations";
import { buildCargoHauler, buildPassengerLiner, buildScout } from "./ships";
import type { AssetEntry, AssetKind } from "./types";

const OUTPOST_ANCHORS = ["parking", "beacon", "entrance"] as const;
const STATION_ANCHORS = ["parking", "dockEntrance", "bayCamera"] as const;
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
  {
    id: "outpost-depot",
    name: "Supply Depot",
    kind: "outpost",
    description: "Rugged, dusty yard with a worn hangar, fuel tanks (one rusty) and a small control tower.",
    variants: 1,
    build: buildOutpostDepot,
    anchorNames: OUTPOST_ANCHORS,
    triangles: 748,
    status: "DRAFT",
  },
  {
    id: "outpost-domes",
    name: "Dome Habitat",
    kind: "outpost",
    description: "Clean white domes with lit windows, a dark glass greenhouse, a small living dome and a round pad.",
    variants: 1,
    build: buildOutpostDomes,
    anchorNames: OUTPOST_ANCHORS,
    triangles: 920,
    status: "DRAFT",
  },
  {
    id: "outpost-comms",
    name: "Comms Station",
    kind: "outpost",
    description: "Small relay: one module, a big dish, a tall mast and solar panels; the pad is painted on the dust, with flags.",
    variants: 1,
    build: buildOutpostComms,
    anchorNames: OUTPOST_ANCHORS,
    triangles: 544,
    status: "DRAFT",
  },
  {
    id: "outpost-hub",
    name: "Passenger Hub",
    kind: "outpost",
    description: "Glass dome concourse with cyan light bands, a glass tube walkway to one big pad, a holo sign and a transit tube.",
    variants: 1,
    build: buildOutpostHub,
    anchorNames: OUTPOST_ANCHORS,
    triangles: 1048,
    status: "DRAFT",
  },
  {
    id: "station-ring",
    name: "Ring Habitat",
    kind: "station",
    description: "Grand white hub with a docking slot on its axis and a slowly spinning ring of lit segments.",
    variants: 1,
    build: buildStationRing,
    anchorNames: [...STATION_ANCHORS, "spinAxis"],
    triangles: 1022,
    status: "DRAFT",
  },
  {
    id: "station-starport",
    name: "Coriolis Starport",
    kind: "station",
    description: "Huge faceted white block with a cyan-lit docking slot and rows of windows.",
    variants: 1,
    build: buildStationStarport,
    anchorNames: STATION_ANCHORS,
    triangles: 822,
    status: "DRAFT",
  },
  {
    id: "station-cargo",
    name: "Cargo Terminal",
    kind: "station",
    description: "Command block with the slot, a long spine of container racks, yellow cranes and solar wings.",
    variants: 1,
    build: buildStationCargo,
    anchorNames: STATION_ANCHORS,
    triangles: 854,
    status: "DRAFT",
  },
  {
    id: "station-refinery",
    name: "Fuel Refinery",
    kind: "station",
    description: "Docking block, four round tanks with orange bands, long tanks and a burning flare stack.",
    variants: 1,
    build: buildStationRefinery,
    anchorNames: STATION_ANCHORS,
    triangles: 1374,
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
