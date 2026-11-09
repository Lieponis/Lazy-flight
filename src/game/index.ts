// Front door of the game rules. Other folders import from here only:
//   import { Game, createClock, parseSpeedParam } from "../game";

export * from "./settings";
export { SHIPS, SHIP_ORDER, getShip, isShipId } from "./ships";
export type { ShipDef } from "./ships";
export { newGameState, normalizeState } from "./state";
export type { GameState } from "./state";
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
export type { BoardEntry, GameListener, OutpostOffer, OwnedOutpost } from "./game";
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
