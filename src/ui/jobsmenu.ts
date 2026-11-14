// JOBS MENU: an overlay over the docked view. Header (dock name, Refuel, Close) and the job board as cards.
// It only READS the game and calls game.accept(jobId), game.refuel(), game.emergencyRefuel() and game.buyOutpost().
// Part 5c: an outpost panel at the top of the list (offer with BUY, or "YOUR OUTPOST"), the fuel discount on
// the Refuel button, and a small "+10%" marker on jobs that end in a system where you own an outpost.

import { refuel, type Game } from "../game";
import { button, el, nameEl, setNameText } from "./dom";
import {
  EMPTY_BOARD_TEXT,
  emergencyVisible,
  noJobsHint,
  formatCredits,
  jobCardText,
  outpostPanelText,
  refuelButton,
  sortForDisplay,
  type JobCardText,
  type PlaceNames,
} from "./logic";
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
    setNameText(this.subtitle, `JOB BOARD · ${this.names.here()}`);

    this.emergencyBtn.hidden = !emergencyVisible(game.isStuck(), game.state.currentJob !== null);
    const fuelBtn = refuelButton(refuel(game.state), game.getPerks().fuelDiscountPercent);
    this.refuelBtn.textContent = fuelBtn.text;
    this.refuelBtn.disabled = fuelBtn.disabled;
    this.refuelHint.textContent = fuelBtn.disabled && !/full/i.test(fuelBtn.hint) ? fuelBtn.hint : "";

    const cards = sortForDisplay(
      game.getBoard().map((entry) =>
        jobCardText(entry, this.names, game.clock.speed, game.getPerks(entry.job.destinationDockId).deliveryBonusPercent),
      ),
    );
    const scrolled = this.list.scrollTop;
    this.list.replaceChildren();
    const outpost = this.outpostPanel();
    if (outpost) this.list.append(outpost);
    if (cards.length === 0) this.list.append(el("div", "ui-empty", EMPTY_BOARD_TEXT));
    const hint = noJobsHint(cards); // 5f: nothing takeable? Exploring is always an option.
    if (hint && cards.length > 0) this.list.append(el("div", "ui-hint-card", hint));
    for (const card of cards) this.list.append(this.card(card));
    this.list.scrollTop = scrolled; // keep the place after refuelling or buying
  }

  /** The outpost of this dock: the offer with BUY, or "YOUR OUTPOST". Nothing at stations. */
  private outpostPanel(): HTMLElement | null {
    const game = this.game;
    const dockId = game.state.currentDockId;
    const offer = game.getOutpostOffer(dockId);
    const t = outpostPanelText(offer, game.state.credits);
    if (!t.show) return null;
    const box = el("div", t.owned ? "ui-outpost ui-outpost-owned" : "ui-outpost");
    const top = el("div", "ui-card-top");
    top.append(el("span", "ui-chip", t.title), el("span", "ui-card-reward", t.price));
    box.append(top, el("div", "ui-outpost-perks", t.perks));
    if (!t.owned) {
      const buy = button(`BUY OUTPOST · ${t.price}`, t.canBuy ? "ui-btn-primary ui-btn-wide" : "ui-btn-wide", () => {
        // Two steps, like NEW GAME: ask first, then buy.
        this.popup.show({
          title: "BUY THIS OUTPOST?",
          big: formatCredits(offer.price ?? 0),
          text: `${offer.dockName} becomes yours. ${t.perks}.`,
          buttons: [{ text: "YES, BUY", primary: true, onClick: () => this.buyOutpost(dockId) }, { text: "CANCEL" }],
        });
      });
      buy.disabled = !t.canBuy;
      box.append(buy);
      if (t.reason) box.append(el("div", "ui-ship-reason", `✕ ${t.reason.toUpperCase()}`));
    }
    return box;
  }

  private buyOutpost(dockId: string): void {
    const result = this.game.buyOutpost(dockId);
    this.render();
    if (result.ok) this.popup.show({ title: "OUTPOST BOUGHT", big: `-${formatCredits(result.price)}`, text: result.line });
    else this.popup.show({ title: "NOT BOUGHT", text: result.reason, warning: true });
  }

  private card(c: JobCardText): HTMLElement {
    const box = el("div", c.takeable ? "ui-card" : "ui-card ui-card-blocked");
    const top = el("div", "ui-card-top");
    const reward = el("span", "ui-card-reward", c.reward);
    if (c.outpostBonus) reward.prepend(el("span", "ui-bonus", `${c.outpostBonus} OUTPOST`)); // your outpost pays extra
    top.append(el("span", "ui-chip", c.kind), reward);
    const title = el("div", "ui-card-title", c.title);
    const dest = nameEl("div", "ui-card-dest", `→ ${c.destination}`); // codes never split (N3a)
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
