// ARRIVAL CARD: "Delivered", the reward and the funny debrief line. Dismiss, or tap anywhere outside.

import type { Arrival } from "../game";
import { button, el } from "./dom";
import { formatCredits } from "./logic";

export class ArrivalCard {
  private root = el("div", "ui-overlay ui-arrival");
  private reward = el("div", "ui-arrival-reward");
  private place = el("div", "ui-panel-sub");
  private line = el("div", "ui-arrival-line");
  private isOpen = false;

  constructor(parent: HTMLElement, private onDismiss: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Delivered");
    const card = el("div", "ui-panel ui-arrival-card");
    card.append(el("div", "ui-panel-title", "DELIVERED"), this.place, this.reward, this.line, button("DISMISS", "ui-btn-primary ui-btn-wide", () => this.onDismiss()));
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
    this.line.textContent = arrival.debrief;
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
