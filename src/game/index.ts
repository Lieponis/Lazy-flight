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
  fuelCost,
  isStuck,
  refuel,
  settleArrival,
  travelProgress,
  tripSeconds,
} from "./rules";
export { buyShip, ownedShipIds, ownsShip, shipCatalog, shipFuel, switchShip } from "./fleet";
export type { FleetResult, ShipCatalogEntry } from "./fleet";
export type { AcceptResult, EmergencyResult, Arrival, Block, BlockCode, RefuelResult, TravelProgress } from "./rules";
export { Game } from "./game";
export type { BoardEntry, GameListener } from "./game";
