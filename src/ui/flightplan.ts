// FLIGHT PLAN (NAV-3, Agent 5k): the hops to your destination (Andy chose B: a big NEXT HOP card first, the rest
// as a short list). Asks the game fresh every time it opens or the game changes (planRoute is pure and cheap).
// FLY NEXT HOP uses the normal free trip (canFreeTravel / freeTravel: the usual strand rules and discovery pay).

import type { Game, RoutePlan } from "../game";
import { button, el, nameEl } from "./dom";
import { PLAN_NONE, hopText, planText } from "./navlogic";

export interface PlanActions {
  destination(): string | null;
  clearDestination(): void;
  showOnMap(): void;
  message(text: string): void;
}

export class FlightPlanScreen {
  private root = el("div", "ui-overlay ui-jobs ui-plan");
  private list = el("div", "ui-cards");
  private sub = el("div", "ui-panel-sub", "");
  private isOpen = false;

  constructor(parent: HTMLElement, private game: Game, private actions: PlanActions, private onClose: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Flight plan");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "FLIGHT PLAN"), this.sub);
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
    const dest = this.actions.destination();
    if (!dest) {
      this.sub.textContent = "";
      this.list.replaceChildren(el("div", "ui-empty", PLAN_NONE));
      return;
    }
    const plan = this.game.planRoute(dest);
    this.sub.textContent = plan.target ? `TO ${plan.target.name}` : "";
    this.list.replaceChildren(...this.parts(plan));
  }

  private parts(plan: RoutePlan): HTMLElement[] {
    const t = planText(plan);
    const out: HTMLElement[] = [];
    const first = plan.hops[0];
    const box = el("div", first ? "ui-plan-next" : "ui-board-msg");
    box.append(el("div", first ? "ui-plan-next-title" : "ui-board-msg-title", t.title));
    if (first) {
      const h = hopText(first);
      box.append(nameEl("div", "ui-plan-next-name", h.title.replace(/^1\. /, "→ ")), nameEl("div", "ui-place-sub", h.sub));
      const docked = this.game.state.spacePlanetId === null && this.game.state.currentJob === null && this.game.state.freeTrip === null;
      if (first.refuelBefore && docked) {
        box.append(el("div", "ui-plan-refuel", h.refuel));
        box.append(
          button("REFUEL", "ui-btn-amber ui-btn-wide", () => {
            const r = this.game.refuel();
            if (!r.ok) this.actions.message(r.reason);
            this.render();
          }),
        );
      } else {
        const check = this.game.canFreeTravel(first.dockId);
        if (check.ok) {
          if (check.newSystem && check.discoveryCredits > 0) box.append(el("div", "ui-fly-discovery", `NEW SYSTEM: +${check.discoveryCredits} CR`));
          box.append(
            button("FLY NEXT HOP", "ui-btn-primary ui-btn-wide", () => {
              const r = this.game.freeTravel(first.dockId);
              if (!r.ok) this.actions.message(r.reason);
            }),
          );
        } else box.append(el("div", "ui-fly-reason", check.reason));
      }
    }
    if (t.message) box.append(nameEl("div", "ui-board-msg-text", t.message));
    if (t.hint) box.append(el("div", "ui-board-msg-hint", t.hint));
    out.push(box);
    if (t.totals) out.push(el("div", "ui-plan-totals", t.totals));
    for (const h of plan.hops.slice(1)) {
      const ht = hopText(h);
      const row = el("div", "ui-card ui-plan-hop");
      row.append(nameEl("div", "ui-place-title", ht.title), nameEl("div", "ui-place-sub", ht.sub));
      if (ht.refuel) row.append(el("div", "ui-plan-refuel", ht.refuel));
      out.push(row);
    }
    if (t.more) out.push(el("div", "ui-plan-totals", t.more));
    const btns = el("div", "ui-place-btns");
    if (plan.hops.length > 0) btns.append(button("SHOW ON MAP", "", () => this.actions.showOnMap()));
    btns.append(button("CLEAR DESTINATION", "", () => this.actions.clearDestination()));
    out.push(btns);
    return out;
  }
}
