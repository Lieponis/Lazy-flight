// STATUS STRIP: always on top. Credits, fuel (number and bar), location, and a small MENU button (docked only).

import { button, el, publishRoom } from "./dom";
import { formatCredits, formatFuel, fuelFraction, fuelIsLow } from "./logic";

export interface StatusInfo {
  credits: number;
  fuel: number;
  tank: number;
  location: string;
}

export class StatusStrip {
  readonly root = el("div", "ui-strip");
  private credits = el("span", "ui-strip-value ui-amber");
  private fuelText = el("span", "ui-strip-value");
  private fuelFill = el("span", "ui-fuelbar-fill");
  private fuelBar = el("span", "ui-fuelbar");
  private location = el("span", "ui-strip-loc");
  private last = "";
  private menuBtn: HTMLButtonElement | null = null;

  constructor(parent: HTMLElement, onMenu?: () => void) {
    const creditBox = el("span", "ui-strip-item");
    creditBox.append(el("span", "ui-strip-key", "CR"), this.credits);
    const fuelBox = el("span", "ui-strip-item");
    this.fuelBar.append(this.fuelFill);
    fuelBox.append(el("span", "ui-strip-key", "FUEL"), this.fuelText, this.fuelBar);
    this.root.append(creditBox, fuelBox, this.location);
    if (onMenu) {
      this.menuBtn = button("MENU", "ui-strip-menu", onMenu);
      this.menuBtn.hidden = true;
      this.root.append(this.menuBtn);
    }
    this.root.setAttribute("aria-live", "polite");
    parent.appendChild(this.root);
    publishRoom(this.root, "--ui-top-reserve", "top");
  }

  /** Show or hide the MENU button (shown with the docked buttons). */
  showMenuButton(show: boolean): void {
    if (this.menuBtn) this.menuBtn.hidden = !show;
  }

  set(info: StatusInfo): void {
    const key = `${info.credits}|${info.fuel}|${info.tank}|${info.location}`;
    if (key === this.last) return; // nothing changed, skip the work
    this.last = key;
    this.credits.textContent = formatCredits(info.credits).replace(/ CR$/, "");
    this.fuelText.textContent = formatFuel(info.fuel, info.tank);
    this.fuelFill.style.width = `${(fuelFraction(info.fuel, info.tank) * 100).toFixed(0)}%`;
    this.fuelBar.classList.toggle("ui-low", fuelIsLow(info.fuel, info.tank));
    this.location.textContent = info.location;
    this.location.title = info.location;
  }
}
