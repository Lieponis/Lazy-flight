// Saving and loading player progress in the browser's own storage (localStorage).
// Only the player's progress is saved. The universe is NEVER saved: it is rebuilt from the seed.
//
// Everything here is careful: private windows, full storage or blocked storage must never crash the game.
// When storage does not work, the game simply plays on without saving (the UI shows a small notice).

import type { GameState } from "../game";
import { UNIVERSE_VERSION } from "../universe";

/** Bump this when the save layout changes in a way old saves cannot follow. */
export const SAVE_VERSION = 1;
/** The one key the save lives under. */
export const SAVE_KEY = "lazy-freight.save";
/** Where a broken or unreadable save is kept (once), so nothing is lost silently. */
export const BACKUP_KEY = "lazy-freight.save.broken";

/** What is written to storage (as JSON). */
export interface SaveData {
  version: number;
  /** The universe seed. Same seed = same universe. */
  seed: number;
  /** Real time (Date.now) when this was saved. */
  savedAtRealMs: number;
  /** Game time when this was saved (game time can run ahead of real time with ?speed=). */
  gameNowMs: number;
  /** The player's progress. Null is read as "start fresh in this universe". */
  state: GameState | null;
  /**
   * Which universe rules this progress was made in (UNIVERSE_VERSION when saved). A save without it is from
   * universe version 1. An older number is moved to the current universe on load (see migrate.ts).
   */
  universeVersion?: number;
}

/** The three things we need from localStorage. Tests pass a fake one. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The browser's storage, or null if it cannot be used (private window, blocked, full).
 * Tries a tiny write first, because some browsers only fail on write.
 */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "lazy-freight.probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export type ReadResult =
  | { kind: "none" }
  | { kind: "ok"; data: SaveData }
  | { kind: "bad"; reason: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Checks the shape of parsed save data. Returns the reason it is unusable, or null if fine. */
export function checkSaveData(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "not an object";
  const d = raw as Record<string, unknown>;
  if (d.version !== SAVE_VERSION) return `wrong version (${String(d.version)}, expected ${SAVE_VERSION})`;
  if (!isFiniteNumber(d.seed) || !Number.isInteger(d.seed)) return "bad seed";
  if (!isFiniteNumber(d.savedAtRealMs)) return "bad save time";
  if (!isFiniteNumber(d.gameNowMs)) return "bad game time";
  if (d.universeVersion !== undefined && (!isFiniteNumber(d.universeVersion) || !Number.isInteger(d.universeVersion) || d.universeVersion < 1)) {
    return "bad universe version";
  }
  if (d.state === null) return null; // "start fresh in this universe"
  if (!d.state || typeof d.state !== "object") return "no state";
  const s = d.state as Record<string, unknown>;
  if (typeof s.currentDockId !== "string" || s.currentDockId === "") return "no dock";
  return null;
}

/**
 * Reads the save. Never throws.
 * A broken save (bad JSON, wrong version, wrong shape) is copied to BACKUP_KEY and removed,
 * so the game can start fresh and the broken one is kept once for checking.
 */
export function readSave(storage: StorageLike | null): ReadResult {
  if (!storage) return { kind: "none" };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: "none" };
  }
  if (text === null || text === "") return { kind: "none" };

  let reason: string | null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
    reason = checkSaveData(parsed);
  } catch {
    reason = "broken JSON";
  }
  if (reason === null) return { kind: "ok", data: parsed as SaveData };

  try {
    storage.setItem(BACKUP_KEY, text);
    storage.removeItem(SAVE_KEY);
  } catch {
    // Could not keep a backup. Nothing more to do; the game still starts.
  }
  return { kind: "bad", reason };
}

/** Writes the save. Returns false (never throws) if storage refused it. */
export function writeSave(storage: StorageLike | null, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Builds the save data from the game's state and clocks. */
export function makeSaveData(seed: number, state: GameState | null, gameNowMs: number, realNowMs: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed,
    savedAtRealMs: realNowMs,
    gameNowMs,
    universeVersion: UNIVERSE_VERSION,
    state: state ? (JSON.parse(JSON.stringify(state)) as GameState) : null,
  };
}

/**
 * Trip times are saved in game time. On a new page the game clock starts again at the real time,
 * so saved trip times are moved to fit the new clock:
 * the time that passed while the page was closed counts (times the current ?speed), nothing more, nothing less.
 * A real clock that went backwards counts as no time passed.
 */
export function shiftTravelTimes(
  state: GameState,
  save: Pick<SaveData, "gameNowMs" | "savedAtRealMs">,
  realNowMs: number,
  gameNowMs: number,
  speed: number,
): GameState {
  if (state.travelStartMs === null || state.travelEndMs === null) return state;
  const awayReal = Math.max(0, realNowMs - save.savedAtRealMs);
  const expectedGameNow = save.gameNowMs + awayReal * speed;
  const shift = gameNowMs - expectedGameNow;
  return { ...state, travelStartMs: state.travelStartMs + shift, travelEndMs: state.travelEndMs + shift };
}
