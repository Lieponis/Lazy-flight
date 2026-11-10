// SHIPYARD: an overlay over the docked view, same style as the Jobs menu.
// A card per ship from game.getShipCatalog(): picture, name, description, numbers, price, fuel if owned,
// and BUY / SWITCH / ACTIVE. After buying it asks "Switch to it now?" (Andy's choice).
// Part 5d: owned ships get an UPGRADES button that opens the four upgrade tracks INSIDE the card
// (Andy's choice B): level bar, next effect, BUY LEVEL or MAX. Numbers on the card are the real ones.

import type { Game } from "../game";
import { button, el } from "./dom";
import { formatCredits, shipCardText, upgradeRowText, upgradeTracksFor, type ShipCardText } from "./logic";
import { Popup } from "./popup";
import { shipPictures } from "./shippreview";

export class Shipyard {
  private root = el("div", "ui-overlay ui-jobs ui-shipyard");
  private subtitle = el("div", "ui-panel-sub");
  private list = el("div", "ui-cards");
  private popup: Popup;
  private isOpen = false;
  /** Ships whose upgrades are unfolded. */
  private expanded = new Set<string>();

  constructor(parent: HTMLElement, private game: Game, private onClose: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Shipyard");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "SHIPYARD"), this.subtitle);
    head.append(titles, button("CLOSE", "", () => this.onClose()));
    panel.append(head, this.list);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    parent.appendChild(this.root);
    this.popup = new Popup(parent);
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
    this.popup.close();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  /** True while the "Bought!" message is showing (Esc closes that first). */
  get messageOpen(): boolean {
    return this.popup.opened;
  }

  closeMessage(): void {
    this.popup.close();
  }

  render(): void {
    if (!this.isOpen) return;
    const credits = this.game.state.credits;
    this.subtitle.textContent = `ANY DOCK · SWITCHING IS FREE · YOU HAVE ${formatCredits(credits)}`;
    const catalog = this.game.getShipCatalog();
    const pictures = shipPictures(catalog.map((e) => e.ship.id));
    const scrolled = this.list.scrollTop;
    this.list.replaceChildren(...catalog.map((entry) => this.card(shipCardText(entry, credits), pictures.get(entry.ship.id))));
    this.list.scrollTop = scrolled; // keep the place after buying or switching
  }

  private card(c: ShipCardText, picture: string | undefined): HTMLElement {
    const box = el("div", c.action === "active" ? "ui-card ui-ship ui-ship-active" : "ui-card ui-ship");
    const pic = el("div", "ui-ship-pic");
    if (picture) {
      const img = el("img");
      img.src = picture;
      img.alt = c.name;
      pic.append(img);
    }
    const info = el("div", "ui-ship-info");
    const top = el("div", "ui-card-top");
    top.append(el("span", "ui-card-title", c.name), el("span", "ui-card-reward", c.price));
    const facts = el("div", "ui-card-facts");
    facts.append(fact("CARGO", c.stats.cargo), fact("CABIN", c.stats.cabin), fact("TANK", c.stats.tank));
    info.append(top, el("div", "ui-card-blurb", c.description), facts);
    if (c.fuel) info.append(el("div", "ui-ship-fuel", c.fuel));
    box.append(pic, info, this.action(c));
    if (c.upgradable && this.expanded.has(c.id)) box.append(this.upgrades(c.id, c.name));
    return box;
  }

  /** The four upgrade tracks of one owned ship (5d). */
  private upgrades(shipId: string, shipName: string): HTMLElement {
    const wrap = el("div", "ui-upgrades");
    const credits = this.game.state.credits;
    const tracks: string[] = upgradeTracksFor(this.game.getShipStats(shipId).cabinCapacity); // no comfort without a cabin
    for (const offer of this.game.getUpgradeOffers(shipId).filter((o) => tracks.includes(o.track))) {
      const t = upgradeRowText(offer, credits);
      const row = el("div", t.maxed ? "ui-upgrade ui-upgrade-max" : "ui-upgrade");
      const top = el("div", "ui-card-top");
      top.append(el("span", "ui-upgrade-name", t.name), el("span", "ui-rank-number", t.level));
      const bar = el("div", "ui-rank-bar");
      const fill = el("div", "ui-rank-fill");
      fill.style.width = `${Math.round(t.progress * 100)}%`;
      bar.append(fill);
      const buy = button(t.button, t.canBuy ? "ui-btn-primary ui-btn-wide" : "ui-btn-wide", () => this.buyLevel(shipId, shipName, offer.track));
      buy.disabled = !t.canBuy;
      row.append(top, bar, el("div", "ui-upgrade-effect", t.effect), buy);
      if (t.reason) row.append(el("div", "ui-ship-reason", `✕ ${t.reason.toUpperCase()}`));
      wrap.append(row);
    }
    return wrap;
  }

  private buyLevel(shipId: string, shipName: string, track: string): void {
    const result = this.game.buyUpgrade(shipId, track);
    this.render();
    if (!result.ok) {
      this.popup.show({ title: "NOT UPGRADED", text: result.reason, warning: true });
      return;
    }
    this.popup.show({ title: "UPGRADED", big: `${shipName.toUpperCase()} · LEVEL ${result.level}`, text: result.line });
  }

  private action(c: ShipCardText): HTMLElement {
    const row = el("div", c.upgradable ? "ui-ship-action ui-ship-action-2" : "ui-ship-action");
    if (c.action === "active") {
      row.append(el("div", "ui-active-label", "▶ ACTIVE"));
    } else if (c.action === "switch") {
      row.append(button("SWITCH", "ui-btn-wide", () => this.switchTo(c.id, c.name)));
    } else if (c.action === "buy") {
      row.append(button(`BUY · ${c.price}`, "ui-btn-primary ui-btn-wide", () => this.buy(c.id, c.name)));
    } else {
      const b = button(`BUY · ${c.price}`, "ui-btn-wide", () => undefined);
      b.disabled = true;
      row.append(b, el("div", "ui-ship-reason", `✕ ${c.reason.toUpperCase()}`));
    }
    if (c.upgradable) {
      const open = this.expanded.has(c.id);
      row.append(
        button(open ? `UPGRADES ${c.upgradeLevels} ▲` : `UPGRADES ${c.upgradeLevels} ▼`, open ? "ui-btn-wide ui-btn-on" : "ui-btn-wide", () => {
          if (open) this.expanded.delete(c.id);
          else this.expanded.add(c.id);
          this.render();
        }),
      );
    }
    return row;
  }

  private buy(id: string, name: string): void {
    const result = this.game.buyShip(id);
    this.render();
    if (!result.ok) {
      this.popup.show({ title: "NOT BOUGHT", text: result.reason, warning: true });
      return;
    }
    this.popup.show({
      title: "BOUGHT",
      big: name.toUpperCase(),
      text: "It waits at the dock with a full tank. Switch to it now?",
      buttons: [
        { text: "SWITCH NOW", primary: true, onClick: () => this.switchTo(id, name) },
        { text: "LATER" },
      ],
    });
  }

  private switchTo(id: string, name: string): void {
    const result = this.game.switchShip(id);
    this.render();
    if (!result.ok) this.popup.show({ title: "NO SWITCH", text: result.reason, warning: true });
    else
      this.popup.show({
        title: "SWITCHED",
        big: name.toUpperCase(),
        text: "Your new ride is parked on the pad. The old one waits here, fuel and all.",
        buttons: [{ text: "SEE IT", primary: true, onClick: () => this.onClose() }], // close the menu to show the ship
      });
  }
}

function fact(key: string, value: string): HTMLElement {
  const f = el("span", "ui-fact");
  f.append(el("span", "ui-fact-key", key), el("span", "ui-fact-val", value));
  return f;
}
