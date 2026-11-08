// Starts the temporary game panel and connects it to the render layer.
// Called once from src/main.ts after the render layer is running.

import { Game, createClock, parseSpeedParam } from "../game";
import { getDock, getPlanetsOfSystem } from "../universe";
import { parseSeedParam } from "../render/helpers";
import type { RenderApi } from "../render";
import { START_SEED } from "../render/settings";
import { TradePanel } from "./panel";

export function startUi(api: RenderApi, parent: HTMLElement): Game {
  const seed = parseSeedParam(window.location.search, START_SEED); // same seed the render layer uses
  const startSystemId = api.state.get().currentSystemId; // the start system picked by Agent 3's settings
  const firstDock = getPlanetsOfSystem(seed, startSystemId)[0];
  if (!firstDock) throw new Error("The start system has no dock.");

  const game = new Game(seed, firstDock.id, createClock(parseSpeedParam(window.location.search)));
  const panel = new TradePanel(parent, game);

  // The flight screen follows the game: it starts when a job starts and ends when the job ends.
  // (This is the only place where the game and the flight screen meet; src/render never imports src/game.)
  let flying = false;
  const syncFlight = (): void => {
    const job = game.state.currentJob;
    if (job && !flying) {
      flying = true;
      api.startFlight({
        originDockId: game.state.currentDockId,
        destinationDockId: job.destinationDockId,
        destinationName: getDock(seed, job.destinationDockId)?.name ?? "the destination",
        speed: game.clock.speed,
        getProgress: () => game.progress(),
      });
    } else if (!job && flying) {
      flying = false;
      api.endFlight();
    }
  };

  // The starmap ring and "you are here" follow the player.
  game.subscribe(() => {
    api.setCurrentSystem(game.currentSystemId());
    panel.rebuild();
    syncFlight();
  });
  api.showDocked(game.state.currentDockId); // the home screen: the ship parked at its dock
  syncFlight(); // the page was opened in the middle of a flight

  // Check the clock a few times a second, and the moment the tab wakes up.
  const check = (): void => {
    game.update();
    panel.tick();
  };
  window.setInterval(check, 250);
  document.addEventListener("visibilitychange", check);
  return game;
}
