// Front door of the game rules. Other folders import from here only:
//   import { Game, createClock, parseSpeedParam } from "../game";

export * from "./settings";
export { SHIPS, SHIP_ORDER, getShip, isShipId } from "./ships";
export type { ShipDef } from "./ships";
export { newGameState, normalizeState } from "./state";
export type { FreeTrip, GameState } from "./state";
export { currentPlaceId, isFlying, isInSpace, notDockedReason } from "./location";
export {
  EXPLORER_RANK_NAMES,
  NO_DISCOVERY,
  cleanExplored,
  discoveriesOf,
  discoveryBase,
  explorerInfo,
  explorerRankIndexFor,
  exploredCounts,
  hasExploredPlanet,
  hasExploredSystem,
  parsePlanetId,
  recordArrival,
} from "./explore";
export type { Discovery, ExplorerInfo, ExplorerRankUp } from "./explore";
export {
  checkFreeTravel,
  emergencyRefuelInSpace,
  isStuckInSpace,
  settleFreeArrival,
  startFreeTravel,
  strandReserve,
} from "./freetravel";
export type { FreeArrival, FreeTravelBlock, SpaceEmergencyResult, StartFreeTravelResult, TripFacts } from "./freetravel";
export { createClock, parseSpeedParam, slotOf } from "./clock";
export type { GameClock } from "./clock";
export { formatDuration } from "./format";
export {
  acceptJob,
  checkJob,
  debriefFor,
  emergencyRefuel,
  affordableFuelUnits,
  fuelCost,
  tripFuelCost,
  fuelUnitCents,
  isStuck,
  refuel,
  settleArrival,
  travelProgress,
  periodOfJobId,
  tripSeconds,
  withBonuses,
  withoutDelivered,
} from "./rules";
export { buyShip, ownedShipIds, ownsShip, shipCatalog, shipFuel, switchShip } from "./fleet";
export type { FleetResult, ShipCatalogEntry } from "./fleet";
export type { AcceptResult, EmergencyResult, ExtraBlockCode, PayInfo, RankUp, Arrival, Block, BlockCode, RefuelResult, TravelProgress } from "./rules";
export { Game } from "./game";
export type { BoardEntry, FreeTravelCheck, GameListener, OutpostOffer, OwnedOutpost } from "./game";
export {
  RANK_KINDS,
  RANK_KIND_LABELS,
  RANK_NAMES,
  emptyCompletedJobs,
  isRankKind,
  rankBonusPercent,
  rankIndexFor,
  rankInfos,
  requiredRankIndex,
} from "./ranks";
export type { CompletedJobs, RankInfo, RankKind } from "./ranks";
export {
  buyOutpost,
  deliveryBonusPercentAt,
  fuelDiscountPercentAt,
  outpostBlock,
  outpostPrice,
  ownsOutpost,
  ownsOutpostInSystemOf,
  systemOfDock,
} from "./outposts";
export type { BuyOutpostResult, DockFacts } from "./outposts";
export {
  UPGRADE_TRACKS,
  upgradeTracksOf,
  UPGRADE_TRACK_NAMES,
  buyUpgrade,
  cleanUpgrades,
  clampFuelToTanks,
  isUpgradeTrack,
  noUpgrades,
  shipStats,
  statsFor,
  upgradeBlock,
  upgradeLevels,
  upgradeOffers,
  upgradePrice,
} from "./upgrades";
export type { BuyUpgradeResult, ShipStats, ShipUpgrades, UpgradeOffer, UpgradeTrack } from "./upgrades";
