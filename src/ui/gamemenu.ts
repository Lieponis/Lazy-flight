// MENU: a small overlay over the docked view, same style as the Jobs menu.
// Shows the universe seed and whether saving works, and NEW GAME:
//   NEW GAME -> "Same universe" or "New random universe" -> "Really start over?" -> the page starts again.

import { button, el } from "./dom";
import { Popup } from "./popup";

export interface GameMenuInfo {
  seed: () => number | string;
  savingWorks: () => boolean;
}

export type NewGameChoice = "same" | "random";

export class GameMenu {
  private root = el("div", "ui-overlay ui-jobs ui-gamemenu");
  private seedLine = el("div", "ui-menu-line");
  private saveLine = el("div", "ui-menu-line");
  private popup: Popup;
  private isOpen = false;

  constructor(
    parent: HTMLElement,
    private info: GameMenuInfo,
    private onNewGame: (choice: NewGameChoice) => void,
    private onClose: () => void,
    private onRanks?: () => void,
  ) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Menu");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "MENU"), el("div", "ui-panel-sub", "LAZY FREIGHT"));
    head.append(titles, button("CLOSE", "", () => this.onClose()));
    const body = el("div", "ui-menu-body");
    // RANKS (part 5c): your ranks and the outposts you own.
    if (this.onRanks) body.append(button("RANKS & OUTPOSTS", "ui-btn-primary ui-btn-wide", () => this.onRanks?.()));
    body.append(this.seedLine, this.saveLine, button("NEW GAME", "ui-btn-amber ui-btn-wide", () => this.askUniverse()));
    panel.append(head, body);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    parent.appendChild(this.root);
    this.popup = new Popup(parent);
  }

  private askUniverse(): void {
    this.popup.show({
      title: "NEW GAME",
      text: "Which universe?",
      buttons: [
        { text: "SAME UNIVERSE", primary: true, onClick: () => this.askSure("same") },
        { text: "NEW RANDOM UNIVERSE", onClick: () => this.askSure("random") },
        { text: "CANCEL" },
      ],
    });
  }

  private askSure(choice: NewGameChoice): void {
    // The first card has already closed itself when its button ran this.
    this.popup.show({
      title: "REALLY START OVER?",
      text: "Your credits, ships and job will be gone.",
      warning: true,
      buttons: [{ text: "YES, START OVER", primary: true, onClick: () => this.onNewGame(choice) }, { text: "CANCEL" }],
    });
  }

  get messageOpen(): boolean {
    return this.popup.opened;
  }

  closeMessage(): void {
    this.popup.close();
  }

  open(): void {
    this.isOpen = true;
    this.root.hidden = false;
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.root.hidden = true;
    this.popup.close();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  render(): void {
    if (!this.isOpen) return;
    this.seedLine.textContent = `UNIVERSE SEED: ${String(this.info.seed())}`;
    this.saveLine.textContent = this.info.savingWorks()
      ? "Progress saves by itself."
      : "Saving is off in this browser. Progress is lost on reload.";
    this.saveLine.classList.toggle("ui-red", !this.info.savingWorks());
  }
}

/** A small message at the top that fades by itself (e.g. "Saving is off in this browser"). */
export function showToast(parent: HTMLElement, text: string, ms = 7000): void {
  const toast = el("div", "ui-toast", text);
  toast.setAttribute("role", "status");
  toast.addEventListener("click", () => toast.remove());
  parent.appendChild(toast);
  window.setTimeout(() => toast.remove(), ms);
}
