// Front door of saving. Other folders import from here only:
//   import { planStart, startAutoSave } from "../save";

export {
  BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  checkSaveData,
  getBrowserStorage,
  makeSaveData,
  readSave,
  shiftTravelTimes,
  writeSave,
} from "./save";
export type { ReadResult, SaveData, StorageLike } from "./save";
export { MESSAGE_REBUILT, migrateSave, universeVersionOf } from "./migrate";
export type { Migration } from "./migrate";
export {
  NOTICE_BAD_SAVE,
  NOTICE_NO_STORAGE,
  addressWithSeed,
  addressWithoutSeed,
  planStart,
  randomSeed,
  seedFromAddress,
} from "./startup";
export type { StartPlan } from "./startup";
export { browserPageEvents, fitToUniverse, loadIntoGame, startAutoSave } from "./autosave";
export type { AutoSaver, PageEvents } from "./autosave";
