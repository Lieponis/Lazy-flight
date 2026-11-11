// Decides how a page load starts: continue the save, or a new game (and with which seed).
// Pure logic with the storage passed in, so it is easy to test.
//
// Rules (brief 6a):
//   ?seed=NUMBER in the address  -> new game with that seed (replaces the save)
//   no ?seed, a good save         -> continue the save (its seed and progress)
//   no ?seed, no or broken save   -> new game with the default seed

import type { GameState } from "../game";
import { migrateSave } from "./migrate";
import { readSave, writeSave, type SaveData, type StorageLike } from "./save";

/** Reads ?seed=NUMBER (same pattern the render layer uses). Null if it is not there or not a number. */
export function seedFromAddress(search: string): number | null {
  const match = /[?&]seed=(-?\d{1,12})(?:&|$)/.exec(search);
  if (!match || match[1] === undefined) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/** The address with ?seed=NUMBER set (other parts like ?speed= stay). NEW GAME goes here. */
export function addressWithSeed(search: string, seed: number): string {
  const params = new URLSearchParams(search);
  params.set("seed", String(seed));
  return `?${params.toString()}`;
}

/** The address without ?seed=… (other parts like ?speed= stay). Used so a reload continues instead of restarting. */
export function addressWithoutSeed(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("seed");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

export interface StartPlan {
  seed: number;
  /** The saved progress to continue, or null for a fresh game. */
  state: GameState | null;
  /** The save it came from (for shifting trip times), or null. */
  save: SaveData | null;
  /** Why it starts this way. */
  why: "continue" | "seed-param" | "fresh" | "bad-save";
  /** A short message for the player, or null. */
  notice: string | null;
}

export const NOTICE_NO_STORAGE = "Saving is off in this browser (private window?). You can still play.";
export const NOTICE_BAD_SAVE = "The old save could not be read. Started a new game.";

export function planStart(search: string, storage: StorageLike | null, defaultSeed: number): StartPlan {
  const noStorage = storage === null ? NOTICE_NO_STORAGE : null;
  const fromAddress = seedFromAddress(search);
  if (fromAddress !== null) {
    return { seed: fromAddress, state: null, save: null, why: "seed-param", notice: noStorage };
  }
  const read = readSave(storage);
  if (read.kind === "ok") {
    // An old save (older universe) is moved to the current one first, and written back at once,
    // so the "universe was rebuilt" message is shown only one time.
    const moved = migrateSave(read.data);
    const save = moved.data;
    if (save !== read.data) writeSave(storage, save);
    if (save.state === null) return { seed: save.seed, state: null, save: null, why: "fresh", notice: null };
    return { seed: save.seed, state: save.state, save, why: "continue", notice: moved.message ?? noStorage };
  }
  if (read.kind === "bad") {
    return { seed: defaultSeed, state: null, save: null, why: "bad-save", notice: NOTICE_BAD_SAVE };
  }
  return { seed: defaultSeed, state: null, save: null, why: "fresh", notice: noStorage };
}

/** A random seed for "New random universe" (positive, up to 9 digits so it is easy to read out). */
export function randomSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 999_999_999);
}
