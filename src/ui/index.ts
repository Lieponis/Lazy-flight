// Starts the menus (status strip, JOBS/SHIPYARD/MAP buttons, Jobs menu, Shipyard, Menu, map switch, arrival card)
// and saving (src/save: continue the save on load, save after every change).
// and connects the game to the render layer. Called once from src/main.ts after the render layer is running.
// This is the only place where the game and the screens meet; src/render never imports src/game.

import "./theme.css";
import { Game, createClock, tripFuelCost, type Arrival, type FreeArrival } from "../game";
import { getDock, getPlanet, getSystem, startDockOf } from "../universe";
import type { RenderApi } from "../render";
import { START_SEED } from "../render/settings";
import {
  addressWithSeed,
  addressWithoutSeed,
  browserPageEvents,
  getBrowserStorage,
  loadIntoGame,
  planStart,
  randomSeed,
  startAutoSave,
  type StartPlan,
  type StorageLike,
  MESSAGE_REBUILT,
} from "../save";
import { el } from "./dom";
import { ArrivalCard } from "./arrival";
import { GameMenu, showToast, type NewGameChoice } from "./gamemenu";
import { JobsMenu } from "./jobsmenu";
import { freeArrivalNote, locationText, overlayAllowed, placeLabel, startNotice, visibleControls, type Overlay } from "./logic";
import { Popup } from "./popup";
import { SaveFilePanel } from "./savefile";
import { InstallHint } from "./installhint";
import { TEST_SPEED_KEY, storedTestSpeed } from "./savefilelogic";
import { startSpeed } from "../game/clock";
import { WhatNow } from "./whatnow";
import { PlanetPanel } from "./planetpanel";
import { NavBar } from "./navbar";
import { RanksScreen } from "./ranks";
import { Shipyard } from "./shipyard";
import { startSound } from "./sound";
import { TitleScreen } from "./title";
import { StatusStrip } from "./statusstrip";

/** How this page starts: continue the save, or a new game. Decided once, before anything is drawn. */
export interface StartInfo {
  plan: StartPlan;
  storage: StorageLike | null;
}

/**
 * The ONE place the seed is chosen (src/main.ts calls this first and hands plan.seed to the render layer too,
 * so the game and the 3D layer always use the same universe). Rules: src/save/startup.ts.
 */
export function chooseStart(): StartInfo {
  const storage = getBrowserStorage();
  return { plan: planStart(window.location.search, storage, Number(START_SEED)), storage };
}

export function startUi(api: RenderApi, parent: HTMLElement, start: StartInfo = chooseStart()): Game {
  const { plan, storage } = start;
  const seed = plan.seed; // the same seed main.ts gave the render layer
  const firstDock = startDockOf(seed); // the same start dock for the game, the save and the debug pages

  // ?speed= in the address wins; otherwise the tester speed from MENU > SETTINGS > TESTER (P3); otherwise 1.
  const storedSpeedText = ((): string | null => {
    try {
      return storage?.getItem(TEST_SPEED_KEY) ?? null;
    } catch {
      return null;
    }
  })();
  const game = new Game(seed, firstDock.id, createClock(startSpeed(window.location.search, storedSpeedText)));
  // Saved progress goes in before anything listens or draws (trip times are moved onto the new clock).
  if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, firstDock.id, Date.now());
  // ?seed= has done its job (new game). Remove it so a reload continues this game instead of restarting it.
  if (plan.why === "seed-param") {
    try {
      const { pathname, hash } = window.location;
      window.history.replaceState(window.history.state, "", pathname + addressWithoutSeed(window.location.search) + hash);
    } catch {
      // Some embedded pages refuse this. Harmless: a reload then starts this seed again.
    }
  }
  api.setShip(game.state.shipId, game.currentLivery(game.state.shipId)); // the ship the player owns, in its paint (5f)
  api.setCurrentSystem(game.currentSystemId()); // a loaded save may be in another system

  // ------------------------------------------------------------ names
  const dockName = (dockId: string): string => getDock(seed, dockId)?.name ?? "Unknown dock";
  // Free travel (3g): a trip may start or end at a planet WITHOUT a dock, so its name comes from the planet.
  const placeName = (id: string): string => getDock(seed, id)?.name ?? getPlanet(seed, id)?.name ?? "Unknown place";
  const systemNameOfDock = (dockId: string): string => {
    const dock = getDock(seed, dockId);
    return (dock && getSystem(seed, dock.systemId)?.name) ?? "?";
  };
  /** The star system name of a dock OR a planet without a dock (5f). */
  const systemNameOfPlace = (id: string): string => {
    const planet = getPlanet(seed, id);
    return (planet && getSystem(seed, planet.systemId)?.name) ?? systemNameOfDock(id);
  };
  /** Floating in space at a planet without a dock, with no trip running (5f). */
  const isFloating = (): boolean => game.state.spacePlanetId !== null && game.state.freeTrip === null && game.state.currentJob === null;
  /** Back from the maps: to the docked view, or to the floating scene when there is no dock here (5f). */
  const backHome = (): void => {
    const space = game.state.spacePlanetId;
    if (space !== null && isFloating()) api.showFloating(space);
    else api.showDocked(game.state.currentDockId);
  };

  // ------------------------------------------------------------ the pieces
  const layer = el("div", "ui-layer");
  parent.appendChild(layer);
  // Sound and music (Agent 7a): settings are kept under their own storage key (they survive NEW GAME).
  const sound = startSound(game, layer, storage);
  const setSoundPrefs = (p: ReturnType<typeof sound.getPrefs>, save: boolean): void => {
    sound.setPrefs(p, save);
    strip.setSpeaker(p.muted); // MENU > SETTINGS and the speaker share one mute (Agent 7b)
  };
  const strip = new StatusStrip(
    layer,
    () => {
      overlay = "menu";
      refresh();
    },
    () => setSoundPrefs({ ...sound.getPrefs(), muted: !sound.getPrefs().muted }, true), // SPEAKER (7b)
  );
  strip.setSpeaker(sound.getPrefs().muted);
  let overlay: Overlay = "none";
  let lastViewedSystemId: string | null = null; // the system map the "SYSTEM" tab goes back to

  const closeOverlay = (): void => {
    overlay = "none";
    refresh();
  };
  const jobs = new JobsMenu(layer, game, { dockName, systemNameOfDock, here: () => game.currentSystemName() }, closeOverlay);
  const shipyard = new Shipyard(layer, game, closeOverlay);
  const arrivalCard = new ArrivalCard(layer, closeOverlay);

  // ------------------------------------------------------------ saving
  const saver = startAutoSave(game, storage, browserPageEvents());
  const startNewGame = (choice: NewGameChoice): void => {
    const newSeed = choice === "same" ? Number(seed) : randomSeed();
    saver.stop(); // the old game must not be written back while the page restarts
    const { pathname, hash } = window.location;
    window.location.assign(pathname + addressWithSeed(window.location.search, newSeed) + hash);
  };
  const ranks = new RanksScreen(layer, game, closeOverlay);
  const menu = new GameMenu(
    layer,
    { seed: () => seed, savingWorks: () => saver.working },
    startNewGame,
    closeOverlay,
    () => {
      overlay = "ranks"; // MENU -> RANKS & OUTPOSTS (part 5c)
      refresh();
    },
    { get: sound.getPrefs, set: setSoundPrefs }, // MENU -> SETTINGS (7a)
    {
      onSaveFile: () => {
        overlay = "savefile"; // MENU -> SAVE FILE (P3)
        refresh();
      },
      tester: {
        chosen: () => storedTestSpeed(readTestSpeed()),
        choose: (speed) => {
          try {
            if (speed === 1) storage?.removeItem(TEST_SPEED_KEY);
            else storage?.setItem(TEST_SPEED_KEY, String(speed));
          } catch {
            // storage off: the choice simply does not stick
          }
        },
        running: () => game.clock.speed,
        fromAddress: () => /[?&]speed=/.test(window.location.search),
        reload: () => reloadWithoutSeed(),
      },
    },
  );
  function readTestSpeed(): string | null {
    try {
      return storage?.getItem(TEST_SPEED_KEY) ?? null;
    } catch {
      return null;
    }
  }
  /** Reloads the game page WITHOUT ?seed= (the seed comes from the save), after an import, undo or tester change. */
  function reloadWithoutSeed(): void {
    saver.saveNow(); // keep the latest progress (an import already moved the autosaver aside, see src/save)
    saver.stop();
    const { pathname, hash } = window.location;
    window.location.assign(pathname + addressWithoutSeed(window.location.search) + hash);
  }
  // P3: SAVE FILE panel (Andy chose A) and the once-only install hint (Andy chose A).
  const saveFilePanel = new SaveFilePanel(
    layer,
    {
      storage,
      saveNow: () => saver.saveNow(),
      currentSeed: () => Number(seed),
      reload: () => {
        saver.stop(); // never write the old game over the imported one
        const { pathname, hash } = window.location;
        window.location.assign(pathname + addressWithoutSeed(window.location.search) + hash);
      },
    },
    closeOverlay,
  );
  const installHint = new InstallHint(layer, storage);
  // The start-up note (e.g. "universe was rebuilt") is reworded and stays longer (5e, Andy chose the fading note).
  // It appears when PLAY is pressed, so the title screen never hides it. Tap closes it.
  const showStartNotice = (): void => {
    if (!plan.notice) return;
    const note = startNotice(plan.notice, MESSAGE_REBUILT);
    showToast(layer, note.text, note.ms);
  };
  // 5e: DOCK / SCENERY card on the system map; 5f: FLY HERE on it.
  const planetPanel = new PlanetPanel(layer, seed, game, (reason) => showToast(layer, reason, 7000));
  // 5f: one shared message card for WHAT NOW? answers (no dock here, emergency fuel).
  const message = new Popup(layer);
  const whatNow = new WhatNow(
    layer,
    game,
    placeName,
    () => {
      overlay = "whatnow";
      refresh();
    },
    (choice) => {
      overlay = "none";
      if (choice === "fly") {
        lastViewedSystemId = game.currentSystemId();
        api.leaveFloating(); // the system view of this star: tap a planet, FLY HERE
      } else if (choice === "shipyard") overlay = "shipyard";
      else if (choice === "menu") overlay = "menu";
      else if (choice === "jobs") {
        message.show({ title: "NO DOCK HERE", text: game.whyNotDocked() ?? "Jobs and fuel are sold at docks." });
      } else if (choice === "emergency") {
        const result = game.emergencyRefuel();
        if (result.ok) message.show({ title: "EMERGENCY FUEL", big: `+${result.units} FUEL`, text: result.line });
        else message.show({ title: "NO FREE FUEL", text: result.reason, warning: true });
      }
      refresh();
    },
  );

  const nav = new NavBar(layer, {
    jobs: () => {
      overlay = "jobs";
      refresh();
    },
    shipyard: () => {
      overlay = "shipyard";
      refresh();
    },

    map: () => {
      lastViewedSystemId = game.currentSystemId();
      api.showSystem(lastViewedSystemId);
    },
    showSystem: () => {
      if (api.state.get().screen !== "system") api.showSystem(lastViewedSystemId ?? game.currentSystemId());
    },
    showGalaxy: () => {
      if (api.state.get().screen !== "starmap") api.showStarmap();
    },
    close: () => backHome(),
  });

  // ------------------------------------------------------------ keeping everything in step
  function refreshStrip(): void {
    const job = game.state.currentJob;
    const trip = game.state.freeTrip;
    const space = game.state.spacePlanetId;
    // Where you are, or where you are going (a job, a free trip, or floating at a planet without a dock: 5f).
    const where = job ? job.destinationDockId : trip ? trip.toId : space ?? game.state.currentDockId;
    strip.set({
      credits: game.state.credits,
      fuel: game.state.fuel,
      tank: game.getShipStats().fuelTankSize, // the real tank, with upgrades (5d)
      location: locationText({
        flying: job !== null || trip !== null,
        floating: isFloating(),
        dockName: placeName(where),
        systemName: systemNameOfPlace(where),
      }),
    });
  }

  function refresh(): void {
    const screen = api.state.get().screen;
    // Note: use the screen name and the game's job, not api.isFlying(): when a flight ends, the screen name
    // changes to "docked" a moment before the flight screen is swapped out.
    const flying = game.state.currentJob !== null || game.state.freeTrip !== null;
    const floating = isFloating();
    overlay = overlayAllowed(screen, overlay, flying, floating);
    if (overlay === "jobs") {
      if (!jobs.opened) jobs.open();
    } else jobs.close();
    if (overlay === "shipyard") {
      if (!shipyard.opened) shipyard.open();
    } else shipyard.close();
    if (overlay === "menu") {
      if (!menu.opened) menu.open();
    } else menu.close();
    if (overlay === "savefile") {
      if (!saveFilePanel.opened) saveFilePanel.open();
    } else saveFilePanel.close();
    if (overlay === "ranks") {
      if (!ranks.opened) ranks.open();
    } else ranks.close();
    if (overlay !== "arrival") arrivalCard.close();
    if (overlay === "whatnow") {
      if (!whatNow.opened) whatNow.open();
    } else whatNow.close();
    const controls = visibleControls(screen, overlay, flying, floating);
    nav.apply(controls);
    whatNow.showButton(controls.whatNow);
    installHint.update(controls.dockButtons); // only docked, no menu, no trip
    strip.showMenuButton(controls.dockButtons); // MENU sits at the right end of the strip, docked only
    refreshStrip();
  }

  // The arrival card waits until the docked view is showing at the destination.
  let seenArrival: Arrival | null = null;
  let pendingArrival: Arrival | null = null;
  function maybeShowArrival(): void {
    if (!pendingArrival || api.state.get().screen !== "docked" || game.state.currentJob) return;
    const a = pendingArrival;
    pendingArrival = null;
    overlay = "arrival";
    arrivalCard.open(a, placeLabel(dockName(a.dockId), systemNameOfDock(a.dockId)));
    sound.arrivalShown(a); // ka-ching (and the rank-up jingle)
    refresh();
  }

  // 5f: the note after a free trip (funny line, discovery pay, Explorer rank-up), once the arrival is on screen.
  let seenFreeArrival: FreeArrival | null = null;
  let pendingFreeArrival: FreeArrival | null = null;
  function maybeShowFreeArrival(): void {
    if (!pendingFreeArrival || game.state.freeTrip || game.state.currentJob) return;
    // Wait until the arrival animation is over: docked, or floating at the planet (the floating scene also counts as "flying").
    const onScreen = api.state.get().screen === "docked" || api.floatingPlanetId() !== null;
    if (!onScreen) return;
    const a = pendingFreeArrival;
    pendingFreeArrival = null;
    showToast(layer, freeArrivalNote(a), 9000);
  }

  // The flight screen follows the game: it starts when a job starts and ends when the job ends.
  let flying = false;
  const syncFlight = (): void => {
    const job = game.state.currentJob;
    const trip = job ? null : game.state.freeTrip;
    if (job && !flying) {
      flying = true;
      api.startFlight({
        originDockId: game.state.currentDockId,
        destinationDockId: job.destinationDockId,
        destinationName: dockName(job.destinationDockId),
        stops: job.stops.map(dockName), // tours show their stops in the cockpit (one stop = not a tour)
        shipId: game.state.shipId,
        livery: game.currentLivery(game.state.shipId), // the worn paint job (5f)
        // For the cockpit's fuel screen: fuel left (the trip is already paid), the tank size, and what this trip burns.
        fuel: game.state.fuel,
        fuelMax: game.getShipStats().fuelTankSize, // real numbers with upgrades (5d)
        fuelUsed: tripFuelCost(game.state, job.totalDistance),
        speed: game.clock.speed,
        getProgress: () => game.progress(),
      });
    } else if (trip && !flying) {
      // A free trip (no job): same launch, warp and arrival. The ids may be planets without a dock; the render layer handles both.
      flying = true;
      api.startFlight({
        originDockId: trip.fromId,
        destinationDockId: trip.toId,
        destinationName: placeName(trip.toId),
        shipId: game.state.shipId,
        livery: game.currentLivery(game.state.shipId),
        fuel: game.state.fuel,
        fuelMax: game.getShipStats().fuelTankSize,
        speed: game.clock.speed,
        getProgress: () => game.progress(),
      });
    } else if (!job && !trip && flying) {
      flying = false;
      api.endFlight();
    }
  };

  game.subscribe(() => {
    api.setShip(game.state.shipId, game.currentLivery(game.state.shipId)); // follows buying, switching and painting ships (5f)
    api.setCurrentSystem(game.currentSystemId()); // the starmap ring and "you are here" follow the player
    if (game.lastArrival && game.lastArrival !== seenArrival) {
      seenArrival = game.lastArrival;
      pendingArrival = game.lastArrival;
    }
    if (game.lastFreeArrival && game.lastFreeArrival !== seenFreeArrival) {
      seenFreeArrival = game.lastFreeArrival;
      pendingFreeArrival = game.lastFreeArrival; // shown when the arrival animation is over (see check)
    }
    syncFlight();
    planetPanel.refreshFacts(); // FLY HERE numbers follow fuel and position (5f)
    jobs.render();
    shipyard.render();
    ranks.render();
    refresh();
    maybeShowArrival();
  });

  api.state.subscribe((s) => {
    if (s.screen === "system" && s.viewedSystemId) lastViewedSystemId = s.viewedSystemId;
    planetPanel.update(s.screen, s.viewedSystemId, s.selectedPlanetId);
    refresh();
    maybeShowArrival();
  });

  // Esc closes the top thing: the arrival card, the Jobs menu, or the map.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const screen = api.state.get().screen;
    if (jobs.messageOpen) jobs.closeMessage();
    else if (shipyard.messageOpen) shipyard.closeMessage();
    else if (menu.messageOpen) menu.closeMessage();
    else if (saveFilePanel.messageOpen) saveFilePanel.closeMessage();
    else if (overlay !== "none") closeOverlay();
    else if (message.opened) message.close();
    else if (screen === "system" || screen === "starmap") backHome();
  });

  // TITLE SCREEN (Agent 7b): covers the game until PLAY. The game below starts as before; PLAY's tap also starts the sound.
  const title = new TitleScreen(layer, {
    seed,
    dockId: game.state.currentDockId,
    systemId: game.currentSystemId(),
    onPlay: () => {
      refresh();
      showStartNotice();
    },
  });
  requestAnimationFrame(() => requestAnimationFrame(() => title.markGameReady())); // the game has drawn its first picture

  game.update(); // a saved trip that ended while the page was closed: pay it now (the arrival card follows)
  api.showDocked(game.state.currentDockId); // the home screen: the ship parked at its dock
  syncFlight(); // the page was opened in the middle of a flight
  if (!flying && game.state.spacePlanetId) api.showFloating(game.state.spacePlanetId); // the page was opened while floating in space
  refresh();

  // Check the clock a few times a second, and the moment the tab wakes up.
  const check = (): void => {
    game.update();
    jobs.tick();
    refreshStrip();
    maybeShowFreeArrival(); // 5f
    sound.tick(); // flight sounds and the music's mood follow the trip
  };
  window.setInterval(check, 250);
  document.addEventListener("visibilitychange", check);
  return game;
}
