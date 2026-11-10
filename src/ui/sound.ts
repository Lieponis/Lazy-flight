// Glue between the game and the sound layer (Agent 7a). The sound layer (src/audio) knows nothing about the game;
// this file watches the game, the screens and the buttons, and tells it what happened.
//
// What sounds when (Andy's choices, 2026-11-11):
// - any button: a soft keyboard click; something blocked: a soft "bonk"
// - paid on delivery: ka-ching (+ rank-up jingle); bought a ship, outpost or upgrade: ka-ching; refuel: glug-glug
// - flight: take-off roar + whoosh, warp flash "vacuum implosion", warp hum, whoosh out of warp, engines wind down,
//   whoosh in; a blip when the cockpit shows a new funny line
// - music "Nebula drift": quieter with a calm engine hum while docked, deeper and lo-fi in warp

import type { Arrival, Game } from "../game";
import { getDock } from "../universe";
import { phaseDurations, planFlight, realTimes, type PhaseSettings } from "../render/flightplan";
import {
  COCKPIT_MESSAGE_SECONDS,
  COCKPIT_STATUS_SECONDS,
  FLIGHT_APPROACH_SECONDS,
  FLIGHT_APPROACH_SECONDS_STATION,
  FLIGHT_LAUNCH_SECONDS,
  FLIGHT_MIN_WARP_SECONDS,
} from "../render/settings";
import {
  SoundEngine,
  changeSound,
  flightCues,
  funnyLineStarted,
  loadPrefs,
  moodFor,
  savePrefs,
  type Phase,
  type PrefsStorage,
  type SoundPrefs,
} from "../audio";

export interface SoundGlue {
  /** Call often (the UI's clock tick) and after every game change. */
  tick(): void;
  /** The arrival card is now showing: ka-ching (and the rank-up jingle). */
  arrivalShown(arrival: Arrival): void;
  /** For MENU -> SETTINGS. */
  getPrefs(): SoundPrefs;
  /** Live change (slider moving). `save` = also remember it (slider released, button pressed). */
  setPrefs(prefs: SoundPrefs, save: boolean): void;
}

/** The phase split the flight screen uses (src/render/flight.ts). Stations have a longer approach. */
function phaseSettings(game: Game, destinationDockId: string): PhaseSettings {
  const station = getDock(game.seed, destinationDockId)?.kind === "STATION";
  return {
    launchSeconds: FLIGHT_LAUNCH_SECONDS,
    approachSeconds: station ? FLIGHT_APPROACH_SECONDS_STATION : FLIGHT_APPROACH_SECONDS,
    minWarpSeconds: FLIGHT_MIN_WARP_SECONDS,
  };
}

export function startSound(game: Game, layer: HTMLElement, storage: PrefsStorage | null): SoundGlue {
  let prefs = loadPrefs(storage);
  const engine = new SoundEngine(prefs);

  // ------------------------------------------------------------ first tap switches sound on
  // Every kind of first touch counts (Andy, 2026-11-11): a press, a click, a key, the end of a touch or of a drag
  // (e.g. turning the camera). These are the events browsers accept as "the player did something".
  const unlock = (): void => engine.unlock();
  for (const type of ["mousedown", "pointerup", "click", "touchend", "keydown"]) window.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => engine.setHidden(document.hidden));
  // iPhone: switching apps can also leave / restore the page this way (back-forward cache).
  window.addEventListener("pagehide", () => engine.setHidden(true));
  window.addEventListener("pageshow", () => engine.setHidden(document.hidden));

  // ------------------------------------------------------------ buttons: click, and bonk when blocked
  layer.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && !b.disabled) engine.play("click");
    },
    true,
  );
  // A tap on a greyed-out button (some browsers send no click for those).
  layer.addEventListener(
    "pointerdown",
    (e) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit?.closest("button:disabled")) {
        engine.unlock();
        engine.play("bonk");
      }
    },
    true,
  );
  // A red "NOT BOUGHT" / "NO SWITCH" card, or the Jobs menu's red notice ("Not enough credits").
  let lastBonk = 0;
  const bonk = (): void => {
    const now = Date.now();
    if (now - lastBonk < 400) return;
    lastBonk = now;
    engine.play("bonk");
  };
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver((records) => {
      for (const r of records) {
        const target = r.target as Element;
        if (target.classList?.contains("ui-notice") && (target.textContent ?? "").trim() !== "") bonk();
        for (const node of Array.from(r.addedNodes)) {
          if (!(node instanceof Element)) continue;
          const red = node.matches(".ui-panel-title.ui-red") ? node : node.querySelector(".ui-panel-title.ui-red");
          // "REALLY START OVER?" is red too, but it is a question, not a refusal.
          if (red && !/START OVER/i.test(red.textContent ?? "")) bonk();
        }
      }
    }).observe(layer, { childList: true, subtree: true });
  }

  // ------------------------------------------------------------ money and fuel
  let seen = { credits: game.state.credits, fuel: game.state.fuel, shipId: game.state.shipId, flying: game.state.currentJob !== null, arrival: game.lastArrival };
  game.subscribe(() => {
    const now = { credits: game.state.credits, fuel: game.state.fuel, shipId: game.state.shipId, flying: game.state.currentJob !== null, arrival: game.lastArrival };
    // A delivery pays when the card shows (arrivalShown); starting a trip burns fuel silently.
    if (now.flying === seen.flying && now.arrival === seen.arrival) {
      const s = changeSound({ before: seen.credits, after: now.credits }, { before: seen.fuel, after: now.fuel }, now.shipId === seen.shipId);
      if (s) engine.play(s);
    }
    seen = now;
    tick();
  });

  // ------------------------------------------------------------ flight
  let tripKey: string | null = null;
  let lastElapsed: number | null = null;
  function tick(): void {
    const job = game.state.currentJob;
    const progress = job ? game.progress() : null;
    let phase: Phase | null = null;
    if (job && progress) {
      const settings = phaseSettings(game, job.destinationDockId);
      const real = realTimes(progress, game.clock.speed);
      const plan = planFlight(progress.fraction, real.remainingRealMs, real.totalRealMs, settings);
      phase = plan.phase;
      const key = `${job.id}@${String(game.state.travelStartMs)}`;
      if (key !== tripKey) {
        tripKey = key;
        lastElapsed = null; // a new trip, or the page opened in the middle of one
      }
      const lengths = phaseDurations(plan.totalSeconds, settings);
      for (const cue of flightCues(lengths, lastElapsed, plan.elapsedSeconds)) engine.play(cue.sound, cue.delay, cue.length);
      if (funnyLineStarted(lastElapsed, plan.elapsedSeconds, COCKPIT_STATUS_SECONDS, COCKPIT_STATUS_SECONDS + COCKPIT_MESSAGE_SECONDS)) {
        engine.play("blip");
      }
      lastElapsed = plan.elapsedSeconds;
    } else {
      tripKey = null;
      lastElapsed = null;
    }
    engine.setMood(moodFor(job !== null, phase));
  }

  return {
    tick,
    arrivalShown(arrival: Arrival): void {
      engine.play("kaching");
      if (arrival.rankUp) engine.play("rankup", 0.7);
    },
    getPrefs: () => ({ ...prefs }),
    setPrefs(next: SoundPrefs, save: boolean): void {
      prefs = { ...next };
      engine.setPrefs(prefs);
      if (save) savePrefs(storage, prefs);
    },
  };
}
