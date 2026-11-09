// RANKS: an overlay over the docked view (opened from MENU), same style as the Jobs menu.
// One card per category (cargo, passengers, tours): rank name, progress bar to the next rank, pay bonus,
// biggest job allowed. Below: the outposts you own and their perks. Read-only, from game.getRanks() and
// game.getOwnedOutposts().

import type { Game } from "../game";
import { button, el } from "./dom";
import { ownedOutpostLine, perksText, rankRowText } from "./logic";

export class RanksScreen {
  private root = el("div", "ui-overlay ui-jobs ui-ranks");
  private list = el("div", "ui-cards");
  private isOpen = false;

  constructor(parent: HTMLElement, private game: Game, private onClose: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Ranks");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "RANKS"), el("div", "ui-panel-sub", "DELIVER JOBS TO RANK UP"));
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
    const rows = this.game.getRanks().map((r) => {
      const t = rankRowText(r);
      const box = el("div", "ui-card ui-rank");
      const top = el("div", "ui-card-top");
      top.append(el("span", "ui-chip", t.label), el("span", "ui-rank-number", t.rankNumber));
      const bar = el("div", "ui-rank-bar");
      const fill = el("div", "ui-rank-fill");
      fill.style.width = `${Math.round(t.progress * 100)}%`;
      bar.append(fill);
      const facts = el("div", "ui-card-facts");
      facts.append(fact("BONUS", t.bonus), fact("LIMIT", t.limit));
      box.append(top, el("div", "ui-card-title", t.rankName), bar, el("div", "ui-rank-next", `${t.next} · ${t.done}`), facts);
      return box;
    });

    const owned = this.game.getOwnedOutposts();
    const outposts = el("div", "ui-card ui-outpost ui-outpost-owned");
    const top = el("div", "ui-card-top");
    top.append(el("span", "ui-chip", "YOUR OUTPOSTS"), el("span", "ui-rank-number", String(owned.length)));
    outposts.append(top);
    if (owned.length === 0) {
      outposts.append(el("div", "ui-card-blurb", "None yet. Dock at an outpost and open JOBS to buy it."));
    } else {
      for (const o of owned) {
        const perks = this.game.getOutpostOffer(o.dockId).perks;
        const item = el("div", "ui-owned");
        item.append(el("div", "ui-owned-name", ownedOutpostLine(o)), el("div", "ui-outpost-perks", perksText(perks, o.systemName)));
        outposts.append(item);
      }
    }
    this.list.replaceChildren(...rows, outposts);
  }
}

function fact(key: string, value: string): HTMLElement {
  const f = el("span", "ui-fact");
  f.append(el("span", "ui-fact-key", key), el("span", "ui-fact-val", value));
  return f;
}
