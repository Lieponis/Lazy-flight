// WHAT NOW? (5f): floating in space at a planet without a dock. Andy chose C: a nearly empty screen to enjoy the
// view, with one button that opens a short list of what you CAN do: fly somewhere (the map), the shipyard, the Jobs
// and fuel refusal line, emergency fuel (only when stuck), the menu, or just stay.

import type { Game } from "../game";
import { button, el } from "./dom";
import { whatNowChoices } from "./logic";

export type WhatNowChoice = ReturnType<typeof whatNowChoices>[number]["id"];

export class WhatNow {
  /** The small button near the top right. */
  private openBtn: HTMLButtonElement;
  /** The sheet with the choices. */
  private root = el("div", "ui-overlay ui-whatnow");
  private title = el("div", "ui-panel-title");
  private sub = el("div", "ui-panel-sub");
  private list = el("div", "ui-whatnow-list");
  private isOpen = false;

  constructor(
    parent: HTMLElement,
    private game: Game,
    private placeName: (id: string) => string,
    private onOpen: () => void,
    private onChoice: (choice: WhatNowChoice) => void,
  ) {
    this.openBtn = button("WHAT NOW?", "ui-btn-primary ui-whatnow-btn", () => this.onOpen());
    this.openBtn.hidden = true;
    parent.appendChild(this.openBtn);

    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "What now?");
    const panel = el("div", "ui-panel ui-whatnow-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(this.title, this.sub);
    head.append(titles);
    panel.append(head, this.list);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onChoice("stay"); // tap outside: stay
    });
    parent.appendChild(this.root);
  }

  /** Show or hide the WHAT NOW? button. */
  showButton(on: boolean): void {
    this.openBtn.hidden = !on;
    document.body.classList.toggle("ui-whatnow-on", on); // notes move below the button (theme.css)
  }

  open(): void {
    this.isOpen = true;
    const id = this.game.state.spacePlanetId;
    this.title.textContent = id ? `AT ${this.placeName(id).toUpperCase()}` : "IN SPACE";
    this.sub.textContent = this.game.whyNotDocked() ?? "";
    this.list.replaceChildren(
      ...whatNowChoices(this.game.isStuck()).map((c) =>
        button(c.text, c.id === "fly" ? "ui-btn-primary ui-btn-wide" : c.id === "emergency" ? "ui-btn-red ui-btn-wide" : "ui-btn-wide", () =>
          this.onChoice(c.id),
        ),
      ),
    );
    this.root.hidden = false;
  }

  close(): void {
    this.isOpen = false;
    this.root.hidden = true;
  }

  get opened(): boolean {
    return this.isOpen;
  }
}
