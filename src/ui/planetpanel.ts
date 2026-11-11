// PLANET PANEL (5e): on the system map, tapping a planet shows a card at the bottom.
// Docks get an amber "DOCK · OUTPOST / STATION" tag with the dock's name; planets without a dock get a grey
// "SCENERY" tag and a funny line (Andy chose layout A). Before anything is tapped, a short hint shows.
// It replaces the render layer's plain text label on the system map only (hidden by CSS while this panel is up),
// so src/render needs no change. Read-only: universe data and game.getOutpostOffer().
//
// 5f: FLY HERE for any planet (dock or scenery): the facts on the card (fuel, fuel left on arrival, trip time,
// discovery pay) and one tap flies (Andy chose B). The numbers and the refusal text come from game.canFreeTravel();
// the refusal is always shown. The flight itself starts in index.ts (syncFlight follows game.state.freeTrip).

import type { Game } from "../game";
import { getDock, getPlanetsOfSystem } from "../universe";
import { planetTypeLabel } from "../render/helpers";
import { button, el } from "./dom";
import { PLANET_PANEL_HINT, flyHereText, planetPanelText } from "./logic";

export class PlanetPanel {
  private root = el("div", "ui-planet");
  private shown = "";
  private last: { screen: string; systemId: string | null; planetId: string | null } = { screen: "", systemId: null, planetId: null };

  constructor(
    parent: HTMLElement,
    private seed: number,
    private game: Game,
    /** Called with the refusal or result text of a FLY HERE tap that did not start (rare: things changed). */
    private onFlyFailed: (reason: string) => void,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("aria-live", "polite");
    parent.appendChild(this.root);
  }

  /** Call again when the game changes (fuel, credits, position): the Fly-here numbers follow. */
  refreshFacts(): void {
    this.shown = "";
    this.update(this.last.screen, this.last.systemId, this.last.planetId);
  }

  /** Call when the screen or the selection changes. */
  update(screen: string, systemId: string | null, planetId: string | null): void {
    this.last = { screen, systemId, planetId };
    const onMap = screen === "system" && systemId !== null;
    document.body.classList.toggle("ui-planet-panel-on", onMap); // hides the render layer's plain label (theme.css)
    this.root.hidden = !onMap;
    if (!onMap) return;
    const planet = planetId ? getPlanetsOfSystem(this.seed, systemId).find((p) => p.id === planetId) : undefined;
    const dock = planet ? getDock(this.seed, planet.id) : null;
    const owned = dock ? this.game.getOutpostOffer(dock.id).owned : false;
    const here = dock !== null && dock.id === this.game.state.currentDockId && this.game.state.spacePlanetId === null;
    const floatingHere = planet !== undefined && this.game.state.spacePlanetId === planet.id;
    const check = planet ? this.game.canFreeTravel(planet.id) : null;
    const fly = check ? flyHereText(check, this.game.getShipStats().fuelTankSize, this.game.clock.speed) : null;
    const key = `${planet?.id ?? ""}|${owned}|${here}|${floatingHere}|${JSON.stringify(fly)}`;
    if (key === this.shown) return;
    this.shown = key;

    if (!planet) {
      this.root.className = "ui-planet ui-planet-hint";
      this.root.replaceChildren(el("div", "ui-planet-line", PLANET_PANEL_HINT));
      return;
    }
    const t = planetPanelText({
      planetId: planet.id,
      planetName: planet.name,
      typeLabel: planetTypeLabel(planet.type),
      radius: planet.radius,
      dock: dock ? { name: dock.name, kind: dock.kind } : null,
      here,
      owned,
    });
    this.root.className = t.isDock ? "ui-planet ui-planet-dock" : "ui-planet ui-planet-scenery";
    const top = el("div", "ui-card-top");
    top.append(el("span", "ui-chip", t.tag));
    if (t.here) top.append(el("span", "ui-planet-here", t.here));
    else if (floatingHere) top.append(el("span", "ui-planet-here", "YOU ARE HERE"));
    const parts: HTMLElement[] = [top, el("div", "ui-planet-title", t.title), el("div", "ui-planet-details", t.details)];
    if (!fly || !fly.canFly) parts.push(el("div", "ui-planet-line", t.line));

    // FLY HERE (5f): facts, discovery pay, one tap. Or the game's reason why not.
    if (fly && planet) {
      const box = el("div", "ui-fly");
      if (fly.canFly) {
        box.append(el("div", "ui-fly-facts", fly.facts));
        if (fly.discovery) box.append(el("div", "ui-fly-discovery", fly.discovery));
        const targetId = planet.id;
        box.append(
          button(fly.button, "ui-btn-primary ui-btn-wide", () => {
            const result = this.game.freeTravel(targetId);
            if (!result.ok) this.onFlyFailed(result.reason);
          }),
        );
      } else {
        box.append(el("div", "ui-fly-reason", fly.reason));
      }
      parts.push(box);
    }
    this.root.replaceChildren(...parts);
  }
}
