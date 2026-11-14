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
  devFlagFromAddress,
  devSeedFromAddress,
  forgetSavedGame,
  planStart,
  randomSeed,
  seedFromAddress,
} from "./startup";
export type { StartPlan } from "./startup";
export { browserPageEvents, fitToUniverse, loadIntoGame, startAutoSave } from "./autosave";
export type { AutoSaver, PageEvents } from "./autosave";
export {
  BEFORE_IMPORT_KEY,
  MAX_IMPORT_CHARS,
  REFUSE_BROKEN,
  REFUSE_DAMAGED,
  REFUSE_EMPTY,
  REFUSE_NEWER,
  REFUSE_NOTHING_TO_EXPORT,
  REFUSE_NOT_A_SAVE,
  REFUSE_NO_STORAGE,
  REFUSE_NO_UNDO,
  REFUSE_TOO_BIG,
  REFUSE_WRITE_FAILED,
  SAVE_FILE_FORMAT,
  SAVE_FILE_FORMAT_VERSION,
  SAVE_GENERATION_KEY,
  SAVE_TEXT_PREFIX,
  SOUND_KEY,
  WARN_OLD_UNIVERSE,
  WARN_OTHER_SEED,
  WARN_TRAVELLING,
  applyImport,
  canUndoImport,
  cleanSoundSettings,
  exportSaveFile,
  inspectImport,
  saveFileChecksum,
  saveFileName,
  undoImport,
} from "./transfer";
export type { ApplyResult, ExportResult, InspectResult, SaveFile, SaveSummary, SoundSettings, UndoResult } from "./transfer";
