// PLANET PANEL (5e): on the system map, tapping a planet shows a card at the bottom.
// Docks get an amber "DOCK · OUTPOST / STATION" tag with the dock's name; planets without a dock get a grey
// "SCENERY" tag and a funny line (Andy chose layout A). Before anything is tapped, a short hint shows.
// It replaces the render layer's plain text label on the system map only (hidden by CSS while this panel is up),
// so src/render needs no change. Read-only: universe data and game.getOutpostOffer().

import type { Game } from "../game";
import { getDock, getPlanetsOfSystem } from "../universe";
import { planetTypeLabel } from "../render/helpers";
import { el } from "./dom";
import { PLANET_PANEL_HINT, planetPanelText } from "./logic";

export class PlanetPanel {
  private root = el("div", "ui-planet");
  private shown = "";

  constructor(parent: HTMLElement, private seed: number, private game: Game) {
    this.root.hidden = true;
    this.root.setAttribute("aria-live", "polite");
    parent.appendChild(this.root);
  }

  /** Call when the screen or the selection changes. */
  update(screen: string, systemId: string | null, planetId: string | null): void {
    const onMap = screen === "system" && systemId !== null;
    document.body.classList.toggle("ui-planet-panel-on", onMap); // hides the render layer's plain label (theme.css)
    this.root.hidden = !onMap;
    if (!onMap) return;
    const planet = planetId ? getPlanetsOfSystem(this.seed, systemId).find((p) => p.id === planetId) : undefined;
    const dock = planet ? getDock(this.seed, planet.id) : null;
    const owned = dock ? this.game.getOutpostOffer(dock.id).owned : false;
    const here = dock !== null && dock.id === this.game.state.currentDockId;
    const key = `${planet?.id ?? ""}|${owned}|${here}`;
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
    this.root.replaceChildren(top, el("div", "ui-planet-title", t.title), el("div", "ui-planet-details", t.details), el("div", "ui-planet-line", t.line));
  }
}
