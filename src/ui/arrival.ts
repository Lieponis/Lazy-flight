// ARRIVAL CARD: "Delivered", the reward and the funny debrief line. Dismiss, or tap anywhere outside.

import type { Arrival } from "../game";
import { button, el } from "./dom";
import { formatCredits, rankUpLine } from "./logic";

export class ArrivalCard {
  private root = el("div", "ui-overlay ui-arrival");
  private reward = el("div", "ui-arrival-reward");
  private place = el("div", "ui-panel-sub");
  private line = el("div", "ui-arrival-line");
  private title = el("div", "ui-panel-title", "DELIVERED");
  private rankLine = el("div", "ui-arrival-rank");
  private isOpen = false;

  constructor(parent: HTMLElement, private onDismiss: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Delivered");
    const card = el("div", "ui-panel ui-arrival-card");
    card.append(this.title, this.place, this.reward, this.rankLine, this.line, button("DISMISS", "ui-btn-primary ui-btn-wide", () => this.onDismiss()));
    this.root.append(card);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onDismiss(); // tap outside the card
    });
    parent.appendChild(this.root);
  }

  open(arrival: Arrival, placeName: string): void {
    this.reward.textContent = `+${formatCredits(arrival.reward)}`;
    this.place.textContent = `${arrival.job.amount} × ${arrival.job.itemName} → ${placeName}`;
    this.line.textContent = arrival.debrief; // includes the funny rank-up line when you ranked up
    // Rank up (part 5c): the same card says so, with the new rank's name.
    this.title.textContent = arrival.rankUp ? "DELIVERED · RANK UP!" : "DELIVERED";
    this.rankLine.textContent = rankUpLine(arrival.rankUp);
    this.rankLine.hidden = !arrival.rankUp;
    this.root.hidden = false;
    this.isOpen = true;
  }

  close(): void {
    this.root.hidden = true;
    this.isOpen = false;
  }

  get opened(): boolean {
    return this.isOpen;
  }
}
