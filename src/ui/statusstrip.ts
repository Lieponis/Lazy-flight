// STATUS STRIP: always on top. Credits, fuel (number and bar), location.

import { el, publishRoom } from "./dom";
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

  constructor(parent: HTMLElement) {
    const creditBox = el("span", "ui-strip-item");
    creditBox.append(el("span", "ui-strip-key", "CR"), this.credits);
    const fuelBox = el("span", "ui-strip-item");
    this.fuelBar.append(this.fuelFill);
    fuelBox.append(el("span", "ui-strip-key", "FUEL"), this.fuelText, this.fuelBar);
    this.root.append(creditBox, fuelBox, this.location);
    this.root.setAttribute("aria-live", "polite");
    parent.appendChild(this.root);
    publishRoom(this.root, "--ui-top-reserve", "top");
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
