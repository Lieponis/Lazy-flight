// Decides how a page load starts: continue the save, or a new game (and with which seed).
// Pure logic with the storage passed in, so it is easy to test.
//
// Rules (stage N2, plan docs/plan-unique-names-world-seed.md): everyone plays in the ONE shared universe (WORLD_SEED).
//   normal address (no ?dev=1)    -> ?seed= is ignored. A good save is continued; if it belongs to another seed it is
//                                    MOVED to the world seed first (credits, ranks, ships kept, see migrate.ts).
//   no or broken save              -> new game on the world seed
//   ?dev=1&seed=NUMBER             -> developer: new game with that seed (replaces the save)
//   ?dev=1 and no ?seed=           -> developer: continue the save as it is (its own seed, never moved)

import type { GameState } from "../game";
import { WORLD_SEED } from "../universe";
import { migrateSave } from "./migrate";
import { SAVE_KEY, readSave, writeSave, type SaveData, type StorageLike } from "./save";

/** Reads ?seed=NUMBER (same pattern the render layer uses). Null if it is not there or not a number. */
export function seedFromAddress(search: string): number | null {
  const match = /[?&]seed=(-?\d{1,12})(?:&|$)/.exec(search);
  if (!match || match[1] === undefined) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/** True when the address has ?dev=1 (developer mode: ?seed= works, saves on other seeds are not moved). */
export function devFlagFromAddress(search: string): boolean {
  return /[?&]dev=1(?:&|$)/.test(search);
}

/** The seed the address asks for, but only in developer mode (?dev=1). A normal address gives null, whatever it says. */
export function devSeedFromAddress(search: string): number | null {
  return devFlagFromAddress(search) ? seedFromAddress(search) : null;
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

export function planStart(search: string, storage: StorageLike | null, worldSeed: number = WORLD_SEED): StartPlan {
  const noStorage = storage === null ? NOTICE_NO_STORAGE : null;
  const dev = devFlagFromAddress(search);
  const fromAddress = devSeedFromAddress(search);
  if (fromAddress !== null) {
    return { seed: fromAddress, state: null, save: null, why: "seed-param", notice: noStorage };
  }
  const read = readSave(storage);
  if (read.kind === "ok") {
    // An old save (older universe, or another seed) is moved to the current one first, and written back at once,
    // so the "universe was rebuilt" message is shown only one time. A developer (?dev=1) keeps the save's own seed.
    const moved = migrateSave(read.data, dev ? undefined : worldSeed);
    const save = moved.data;
    if (save !== read.data) writeSave(storage, save);
    if (save.state === null) return { seed: save.seed, state: null, save: null, why: "fresh", notice: null };
    return { seed: save.seed, state: save.state, save, why: "continue", notice: moved.message ?? noStorage };
  }
  if (read.kind === "bad") {
    return { seed: worldSeed, state: null, save: null, why: "bad-save", notice: NOTICE_BAD_SAVE };
  }
  return { seed: worldSeed, state: null, save: null, why: "fresh", notice: noStorage };
}

/**
 * NEW GAME (stage N2): forgets the saved game so the next load starts fresh on the world seed.
 * Returns false if the browser refused (then the old save would simply continue). Sound settings live under another key.
 */
export function forgetSavedGame(storage: StorageLike | null): boolean {
  if (!storage) return true;
  try {
    storage.removeItem(SAVE_KEY);
    return storage.getItem(SAVE_KEY) === null;
  } catch {
    return false;
  }
}

/** UNUSED since N2 (the menu has no "New random universe" any more). Kept only because an old test may call it. */
export function randomSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 999_999_999);
}
