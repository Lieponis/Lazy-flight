// MY PLACES (NAV-3, Agent 5k): the start dock, your outposts, starred places and the last docks you visited, grouped
// (Andy chose A: tap a row and its buttons open under it). Badges as on job cards (READY TO FLY / REFUEL FIRST / NEEDS HOPS).
// Opened from MENU (docked) and from the map bar. Read-only except star/unstar; SET AS DESTINATION and SHOW ON MAP are
// handed to index.ts.

import type { Game, Place } from "../game";
import { button, el, nameEl } from "./dom";
import { PLACES_EMPTY, PLACES_TIP, groupPlaces, placeRowText, starButtonText } from "./navlogic";

export interface PlacesActions {
  setDestination(place: Place): void;
  showOnMap(place: Place): void;
  /** A star or unstar did not work: show the game's reason. */
  message(text: string): void;
  /** The current destination id, to mark its row. */
  destination(): string | null;
}

export class PlacesScreen {
  private root = el("div", "ui-overlay ui-jobs ui-places");
  private list = el("div", "ui-cards");
  private isOpen = false;
  private openId: string | null = null;

  constructor(parent: HTMLElement, private game: Game, private actions: PlacesActions, private onClose: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "My places");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "MY PLACES"), el("div", "ui-panel-sub", PLACES_TIP));
    head.append(titles, button("CLOSE", "", () => this.onClose()));
    panel.append(head, this.list);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    parent.appendChild(this.root);
  }

  open(): void {
    this.isOpen = true;
    this.openId = null;
    this.root.hidden = false;
    this.render();
    this.list.scrollTop = 0;
  }

  close(): void {
    this.isOpen = false;
    this.root.hidden = true;
  }

  get opened(): boolean {
    return this.isOpen;
  }

  render(): void {
    if (!this.isOpen) return;
    const places = this.game.getPlaces();
    const dest = this.actions.destination();
    const parts: HTMLElement[] = [];
    if (places.length === 0) parts.push(el("div", "ui-empty", PLACES_EMPTY));
    for (const g of groupPlaces(places)) {
      parts.push(el("div", "ui-places-group", g.group));
      for (const p of g.places) parts.push(this.row(p, p.id === dest));
    }
    this.list.replaceChildren(...parts);
  }

  private row(p: Place, isDest: boolean): HTMLElement {
    const t = placeRowText(p);
    const open = this.openId === p.id;
    const box = el("div", `ui-card ui-place ui-card-${t.reach === "never" ? "far" : t.reach}${open ? " ui-place-open" : ""}`);
    const top = el("div", "ui-card-top");
    const title = nameEl("div", "ui-place-title", t.title + (t.star ? ` ${t.star}` : ""));
    top.append(title);
    if (t.badge) top.append(el("span", `ui-reach ui-reach-${t.reach === "never" ? "far" : t.reach}`, t.badge));
    box.append(top, nameEl("div", "ui-place-sub", t.sub));
    if (isDest) box.append(el("div", "ui-place-dest", "◆ YOUR DESTINATION"));
    box.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.openId = open ? null : p.id;
      this.render();
    });
    if (open) {
      box.append(el("div", "ui-place-detail", t.detail));
      const btns = el("div", "ui-place-btns");
      if (!p.isHere) btns.append(button("SET AS DESTINATION", "ui-btn-primary", () => this.actions.setDestination(p)));
      btns.append(
        button("SHOW ON MAP", "", () => this.actions.showOnMap(p)),
        button(starButtonText(p.starred), "", () => {
          const r = p.starred ? this.game.unstarPlace(p.id) : this.game.starPlace(p.id);
          if (!r.ok) this.actions.message(r.reason);
          this.render();
        }),
      );
      box.append(btns);
    }
    return box;
  }
}
