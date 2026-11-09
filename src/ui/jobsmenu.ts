// JOBS MENU: an overlay over the docked view. Header (dock name, Refuel, Close) and the job board as cards.
// It only READS the game and calls game.accept(jobId) and game.refuel().

import { refuel, type Game } from "../game";
import { button, el } from "./dom";
import { emergencyVisible, jobCardText, refuelButton, sortForDisplay, type JobCardText, type PlaceNames } from "./logic";
import { Popup } from "./popup";

export class JobsMenu {
  private root = el("div", "ui-overlay ui-jobs");
  private title = el("div", "ui-panel-title");
  private subtitle = el("div", "ui-panel-sub");
  private refuelBtn: HTMLButtonElement;
  private emergencyBtn: HTMLButtonElement;
  private popup: Popup;
  private refuelHint = el("div", "ui-hint");
  private notice = el("div", "ui-notice");
  private list = el("div", "ui-cards");
  private isOpen = false;
  private shownSlot = -1;

  constructor(
    parent: HTMLElement,
    private game: Game,
    private names: PlaceNames & { here: () => string },
    private onClose: () => void,
  ) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Jobs");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(this.title, this.subtitle);
    this.refuelBtn = button("REFUEL", "ui-btn-amber", () => {
      const result = this.game.refuel();
      this.notice.textContent = result.ok ? "" : result.reason;
      this.render();
    });
    // Free fuel, shown only when the game says you are stuck (Agent 4's safety net).
    this.emergencyBtn = button("EMERGENCY FUEL", "ui-btn-red", () => {
      const result = this.game.emergencyRefuel();
      this.render();
      if (result.ok) this.popup.show({ title: "EMERGENCY FUEL", big: `+${result.units} FUEL`, text: result.line });
      else this.popup.show({ title: "NO FREE FUEL", text: result.reason, warning: true });
    });
    head.append(titles, this.emergencyBtn, this.refuelBtn, button("CLOSE", "", () => this.onClose()));
    panel.append(head, this.refuelHint, this.notice, this.list);
    this.root.append(panel);
    this.root.hidden = true;
    // A tap on the dark edge around the panel closes the menu too.
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    parent.appendChild(this.root);
    this.popup = new Popup(parent);
  }

  /** True while the emergency fuel message is showing (Esc closes that first). */
  get messageOpen(): boolean {
    return this.popup.opened;
  }

  closeMessage(): void {
    this.popup.close();
  }

  open(): void {
    this.isOpen = true;
    this.notice.textContent = "";
    this.root.hidden = false;
    this.render();
    this.list.scrollTop = 0;
  }

  close(): void {
    this.isOpen = false;
    this.root.hidden = true;
    this.popup.close();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  /** Called a few times a second: refresh when the board changes with the clock. */
  tick(): void {
    if (this.isOpen && this.game.currentSlot() !== this.shownSlot) this.render();
  }

  /** Rebuilds the contents (called when the game changes). */
  render(): void {
    if (!this.isOpen) return;
    const game = this.game;
    this.shownSlot = game.currentSlot();
    this.title.textContent = this.names.dockName(game.state.currentDockId);
    this.subtitle.textContent = `JOB BOARD · ${this.names.here()}`;

    this.emergencyBtn.hidden = !emergencyVisible(game.isStuck(), game.state.currentJob !== null);
    const fuelBtn = refuelButton(refuel(game.state));
    this.refuelBtn.textContent = fuelBtn.text;
    this.refuelBtn.disabled = fuelBtn.disabled;
    this.refuelHint.textContent = fuelBtn.disabled && !/full/i.test(fuelBtn.hint) ? fuelBtn.hint : "";

    const cards = sortForDisplay(game.getBoard().map((entry) => jobCardText(entry, this.names, game.clock.speed)));
    this.list.replaceChildren();
    if (cards.length === 0) this.list.append(el("div", "ui-empty", "No jobs right now. Check back later."));
    for (const card of cards) this.list.append(this.card(card));
  }

  private card(c: JobCardText): HTMLElement {
    const box = el("div", c.takeable ? "ui-card" : "ui-card ui-card-blocked");
    const top = el("div", "ui-card-top");
    top.append(el("span", "ui-chip", c.kind), el("span", "ui-card-reward", c.reward));
    const title = el("div", "ui-card-title", c.title);
    const dest = el("div", "ui-card-dest", `→ ${c.destination}`);
    const facts = el("div", "ui-card-facts");
    facts.append(fact("DIST", c.distance), fact("TIME", c.time), fact("FUEL", c.fuel.replace(/ FUEL$/, "")));
    const blurb = el("div", "ui-card-blurb", c.blurb);
    box.append(top, title, dest, facts, blurb);
    if (c.takeable) {
      box.append(
        button("ACCEPT", "ui-btn-primary ui-btn-wide", () => {
          const result = this.game.accept(c.id);
          if (result.ok) this.onClose(); // the flight starts (wired in index.ts)
          else {
            this.notice.textContent = result.block.text;
            this.render();
          }
        }),
      );
    } else {
      const reason = el("div", "ui-card-reason");
      reason.append(el("b", undefined, `✕ ${c.reason.toUpperCase()}`), el("span", undefined, c.reasonDetail));
      box.append(reason);
    }
    return box;
  }
}

function fact(key: string, value: string): HTMLElement {
  const f = el("span", "ui-fact");
  f.append(el("span", "ui-fact-key", key), el("span", "ui-fact-val", value));
  return f;
}
