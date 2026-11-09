// Starts the menus (status strip, JOBS/SHIPYARD/MAP buttons, Jobs menu, Shipyard, map switch, arrival card)
// and connects the game to the render layer. Called once from src/main.ts after the render layer is running.
// This is the only place where the game and the screens meet; src/render never imports src/game.

import "./theme.css";
import { Game, createClock, getShip, parseSpeedParam, type Arrival } from "../game";
import { getDock, getPlanetsOfSystem, getSystem } from "../universe";
import { parseSeedParam } from "../render/helpers";
import type { RenderApi } from "../render";
import { START_SEED } from "../render/settings";
import { el } from "./dom";
import { ArrivalCard } from "./arrival";
import { JobsMenu } from "./jobsmenu";
import { locationText, overlayAllowed, placeLabel, visibleControls, type Overlay } from "./logic";
import { NavBar } from "./navbar";
import { Shipyard } from "./shipyard";
import { StatusStrip } from "./statusstrip";

export function startUi(api: RenderApi, parent: HTMLElement): Game {
  const seed = parseSeedParam(window.location.search, START_SEED); // same seed the render layer uses
  const startSystemId = api.state.get().currentSystemId; // the start system picked by Agent 3's settings
  const firstDock = getPlanetsOfSystem(seed, startSystemId)[0];
  if (!firstDock) throw new Error("The start system has no dock.");

  const game = new Game(seed, firstDock.id, createClock(parseSpeedParam(window.location.search)));
  api.setShip(game.state.shipId); // the render layer draws the ship the player owns

  // ------------------------------------------------------------ names
  const dockName = (dockId: string): string => getDock(seed, dockId)?.name ?? "Unknown dock";
  const systemNameOfDock = (dockId: string): string => {
    const dock = getDock(seed, dockId);
    return (dock && getSystem(seed, dock.systemId)?.name) ?? "?";
  };

  // ------------------------------------------------------------ the pieces
  const layer = el("div", "ui-layer");
  parent.appendChild(layer);
  const strip = new StatusStrip(layer);
  let overlay: Overlay = "none";
  let lastViewedSystemId: string | null = null; // the system map the "SYSTEM" tab goes back to

  const closeOverlay = (): void => {
    overlay = "none";
    refresh();
  };
  const jobs = new JobsMenu(layer, game, { dockName, systemNameOfDock, here: () => game.currentSystemName() }, closeOverlay);
  const shipyard = new Shipyard(layer, game, closeOverlay);
  const arrivalCard = new ArrivalCard(layer, closeOverlay);

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
    close: () => api.showDocked(game.state.currentDockId),
  });

  // ------------------------------------------------------------ keeping everything in step
  function refreshStrip(): void {
    const job = game.state.currentJob;
    const where = job ? job.destinationDockId : game.state.currentDockId;
    strip.set({
      credits: game.state.credits,
      fuel: game.state.fuel,
      tank: getShip(game.state.shipId).fuelTankSize,
      location: locationText({ flying: job !== null, dockName: dockName(where), systemName: systemNameOfDock(where) }),
    });
  }

  function refresh(): void {
    const screen = api.state.get().screen;
    // Note: use the screen name and the game's job, not api.isFlying(): when a flight ends, the screen name
    // changes to "docked" a moment before the flight screen is swapped out.
    const flying = game.state.currentJob !== null;
    overlay = overlayAllowed(screen, overlay, flying);
    if (overlay === "jobs") {
      if (!jobs.opened) jobs.open();
    } else jobs.close();
    if (overlay === "shipyard") {
      if (!shipyard.opened) shipyard.open();
    } else shipyard.close();
    if (overlay !== "arrival") arrivalCard.close();
    nav.apply(visibleControls(screen, overlay, flying));
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
    refresh();
  }

  // The flight screen follows the game: it starts when a job starts and ends when the job ends.
  let flying = false;
  const syncFlight = (): void => {
    const job = game.state.currentJob;
    if (job && !flying) {
      flying = true;
      api.startFlight({
        originDockId: game.state.currentDockId,
        destinationDockId: job.destinationDockId,
        destinationName: dockName(job.destinationDockId),
        shipId: game.state.shipId,
        speed: game.clock.speed,
        getProgress: () => game.progress(),
      });
    } else if (!job && flying) {
      flying = false;
      api.endFlight();
    }
  };

  game.subscribe(() => {
    api.setShip(game.state.shipId); // follows buying and switching ships (the docked view redraws the ship)
    api.setCurrentSystem(game.currentSystemId()); // the starmap ring and "you are here" follow the player
    if (game.lastArrival && game.lastArrival !== seenArrival) {
      seenArrival = game.lastArrival;
      pendingArrival = game.lastArrival;
    }
    syncFlight();
    jobs.render();
    shipyard.render();
    refresh();
    maybeShowArrival();
  });

  api.state.subscribe((s) => {
    if (s.screen === "system" && s.viewedSystemId) lastViewedSystemId = s.viewedSystemId;
    refresh();
    maybeShowArrival();
  });

  // Esc closes the top thing: the arrival card, the Jobs menu, or the map.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const screen = api.state.get().screen;
    if (jobs.messageOpen) jobs.closeMessage();
    else if (shipyard.messageOpen) shipyard.closeMessage();
    else if (overlay !== "none") closeOverlay();
    else if (screen === "system" || screen === "starmap") api.showDocked(game.state.currentDockId);
  });

  api.showDocked(game.state.currentDockId); // the home screen: the ship parked at its dock
  syncFlight(); // the page was opened in the middle of a flight
  refresh();

  // Check the clock a few times a second, and the moment the tab wakes up.
  const check = (): void => {
    game.update();
    jobs.tick();
    refreshStrip();
  };
  window.setInterval(check, 250);
  document.addEventListener("visibilitychange", check);
  return game;
}
