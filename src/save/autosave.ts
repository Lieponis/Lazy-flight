// Connects a running Game to the save: loads saved progress into it, then saves after every change
// (accept, arrival, buy, switch, refuel, emergency refuel) and when the page is hidden or closed.
// Not every frame: the game only reports real changes.

import type { Game, GameState } from "../game";
import { getDock, getPlanet, type Seed } from "../universe";
import { makeSaveData, shiftTravelTimes, writeSave, type SaveData, type StorageLike } from "./save";

/**
 * Makes saved progress safe for this universe: a dock that does not exist sends you to the start dock,
 * and a job to a dock that does not exist is dropped (you stay where you left from).
 * The same goes for a free trip or a float at a place that does not exist.
 */
export function fitToUniverse(state: GameState, seed: Seed, startDockId: string): GameState {
  let out = state;
  if (!getDock(seed, out.currentDockId)) out = { ...out, currentDockId: startDockId };
  if (out.currentJob && !getDock(seed, out.currentJob.destinationDockId)) {
    out = { ...out, currentJob: null, travelStartMs: null, travelEndMs: null };
  }
  // A free trip to, or a float at, a place that does not exist here is dropped: you stay docked at your dock.
  if (out.freeTrip && !getPlanet(seed, out.freeTrip.toId)) {
    out = { ...out, freeTrip: null, travelStartMs: null, travelEndMs: null };
  }
  if (out.spacePlanetId !== null && (!getPlanet(seed, out.spacePlanetId) || getDock(seed, out.spacePlanetId))) {
    out = { ...out, spacePlanetId: null };
  }
  return out;
}

/** Puts saved progress into the game: trip times moved to the new clock, then the game's own repair (loadState). */
export function loadIntoGame(game: Game, save: SaveData, state: GameState, startDockId: string, realNowMs: number): void {
  const fitted = fitToUniverse(state, game.seed, startDockId);
  const shifted = shiftTravelTimes(fitted, save, realNowMs, game.clock.now(), game.clock.speed);
  game.loadState(shifted);
}

/** The small part of `window`/`document` the autosaver needs (tests pass a fake). */
export interface PageEvents {
  onHidden(fn: () => void): void;
}

export function browserPageEvents(): PageEvents {
  return {
    onHidden(fn) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") fn();
      });
      window.addEventListener("pagehide", fn);
    },
  };
}

export interface AutoSaver {
  /** Save now. Returns false if storage refused. */
  saveNow(): boolean;
  /** Stop saving (used by NEW GAME so the old game is not written back while the page reloads). */
  stop(): void;
  /** True while saves are being written successfully. */
  readonly working: boolean;
}

export function startAutoSave(
  game: Game,
  storage: StorageLike | null,
  page: PageEvents | null,
  realNow: () => number = Date.now,
): AutoSaver {
  let stopped = false;
  let working = storage !== null;
  const saveNow = (): boolean => {
    if (stopped) return false;
    working = writeSave(storage, makeSaveData(Number(game.seed), game.state, game.clock.now(), realNow()));
    return working;
  };
  game.subscribe(saveNow);
  page?.onHidden(saveNow);
  saveNow(); // so a fresh game (or a ?seed game) replaces the old save straight away
  return {
    saveNow,
    stop: () => {
      stopped = true;
    },
    get working() {
      return working;
    },
  };
}
