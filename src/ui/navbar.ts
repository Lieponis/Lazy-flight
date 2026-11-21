// The bottom bar. In the docked view: JOBS, SHIPYARD and MAP. On the maps: the System | Galaxy switch and CLOSE.
// During flight it is hidden (the flight screen has its own bar).

import { button, el, publishRoom } from "./dom";
import type { Controls } from "./logic";

export interface NavActions {
  jobs(): void;
  shipyard(): void;
  map(): void;
  showSystem(): void;
  showGalaxy(): void;
  close(): void;
  /** NAV-3: MY PLACES from the map bar, and the star button of the docked view. */
  places(): void;
  star(): void;
}

export class NavBar {
  private root = el("div", "ui-nav");
  private dockGroup = el("div", "ui-nav-group");
  private mapGroup = el("div", "ui-nav-group");
  private systemTab: HTMLButtonElement;
  private galaxyTab: HTMLButtonElement;
  private starBtn: HTMLButtonElement;
  private updateRoom: () => void;

  constructor(parent: HTMLElement, actions: NavActions) {
    this.dockGroup.append(
      button("JOBS", "ui-btn-big ui-btn-primary", actions.jobs),
      button("SHIPYARD", "ui-btn-big", actions.shipyard),
      button("MAP", "ui-btn-big", actions.map),
    );
    this.starBtn = button("☆", "ui-btn-big ui-nav-star", actions.star); // NAV-3: star this dock
    this.starBtn.setAttribute("aria-label", "Star this place");
    this.dockGroup.append(this.starBtn);
    const tabs = el("div", "ui-tabs");
    tabs.setAttribute("role", "tablist");
    this.systemTab = button("SYSTEM", "ui-tab", actions.showSystem);
    this.galaxyTab = button("GALAXY", "ui-tab", actions.showGalaxy);
    for (const t of [this.systemTab, this.galaxyTab]) t.setAttribute("role", "tab");
    tabs.append(this.systemTab, this.galaxyTab);
    this.mapGroup.append(tabs, button("PLACES", "ui-btn-big", actions.places), button("CLOSE", "ui-btn-big", actions.close));
    this.root.append(this.dockGroup, this.mapGroup);
    parent.appendChild(this.root);
    this.updateRoom = publishRoom(this.root, "--ui-bottom-reserve", "bottom");
    this.apply({ statusStrip: true, dockButtons: false, mapBar: false, mapTab: null, whatNow: false });
  }

  /** NAV-3: the docked view's star button shows ★ when this dock is starred. */
  setStarred(starred: boolean): void {
    const t = starred ? "★" : "☆";
    if (this.starBtn.textContent !== t) this.starBtn.textContent = t;
    this.starBtn.classList.toggle("ui-nav-star-on", starred);
  }

  apply(c: Controls): void {
    this.dockGroup.hidden = !c.dockButtons;
    this.mapGroup.hidden = !c.mapBar;
    this.root.hidden = !c.dockButtons && !c.mapBar;
    for (const [tab, name] of [
      [this.systemTab, "system"],
      [this.galaxyTab, "galaxy"],
    ] as const) {
      const on = c.mapTab === name;
      tab.classList.toggle("ui-tab-on", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    }
    this.updateRoom();
  }
}
