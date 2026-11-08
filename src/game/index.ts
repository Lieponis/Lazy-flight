// Front door of the game rules. Other folders import from here only:
//   import { Game, createClock, parseSpeedParam } from "../game";

export * from "./settings";
export { SHIPS, getShip } from "./ships";
export type { ShipDef } from "./ships";
export { newGameState } from "./state";
export type { GameState } from "./state";
export { createClock, parseSpeedParam, slotOf } from "./clock";
export type { GameClock } from "./clock";
export { formatDuration } from "./format";
export {
  acceptJob,
  checkJob,
  debriefFor,
  fuelCost,
  refuel,
  settleArrival,
  travelProgress,
  tripSeconds,
} from "./rules";
export type { AcceptResult, Arrival, Block, BlockCode, RefuelResult, TravelProgress } from "./rules";
export { Game } from "./game";
export type { BoardEntry, GameListener } from "./game";
