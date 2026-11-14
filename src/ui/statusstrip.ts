// STATUS STRIP: always on top. Credits, fuel (number and bar), location, a SPEAKER button (sound on/off, always there,
// Agent 7b) and a small MENU button (docked only; in flight the speaker sits alone at the right end).

import { button, el, fitText, publishRoom } from "./dom";
import { fitLocation, formatCredits, formatFuel, fuelFraction, fuelIsLow, locationText } from "./logic";

/** Where you are or are going. systemName "" = a planet whose own name already holds the system (N3a). */
export interface StripLocation {
  flying: boolean;
  floating?: boolean;
  dockName: string;
  systemName: string;
}

export interface StatusInfo {
  credits: number;
  fuel: number;
  tank: number;
  location: StripLocation;
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
  private speakerBtn: HTMLButtonElement | null = null;

  constructor(parent: HTMLElement, onMenu?: () => void, onSpeaker?: () => void) {
    const creditBox = el("span", "ui-strip-item");
    creditBox.append(el("span", "ui-strip-key", "CR"), this.credits);
    const fuelBox = el("span", "ui-strip-item");
    this.fuelBar.append(this.fuelFill);
    fuelBox.append(el("span", "ui-strip-key", "FUEL"), this.fuelText, this.fuelBar);
    this.root.append(creditBox, fuelBox, this.location);
    if (onSpeaker) {
      this.speakerBtn = button("", "ui-strip-speaker", onSpeaker);
      this.setSpeaker(false);
      this.root.append(this.speakerBtn);
    }
    if (onMenu) {
      this.menuBtn = button("MENU", "ui-strip-menu", onMenu);
      this.menuBtn.hidden = true;
      this.root.append(this.menuBtn);
    }
    this.root.setAttribute("aria-live", "polite");
    parent.appendChild(this.root);
    publishRoom(this.root, "--ui-top-reserve", "top");
    // Turning the phone changes the room: fit the location again (N3a).
    window.addEventListener("resize", () => this.fitLocation());
  }

  private lastLocation: StripLocation | null = null;

  /** The location in one line: long names shorten their word part and keep the code (Andy chose B). */
  private fitLocation(): void {
    const loc = this.lastLocation;
    if (!loc) return;
    fitText(this.location, locationText(loc), (max) => fitLocation(loc, max));
  }

  /** The speaker shows the sound state: on (teal) or muted (red, crossed out). */
  setSpeaker(muted: boolean, style: SpeakerStyle = SPEAKER_STYLE): void {
    const b = this.speakerBtn;
    if (!b) return;
    b.replaceChildren(...speakerContent(muted, style));
    b.classList.toggle("ui-muted", muted);
    b.setAttribute("aria-label", muted ? "Sound is off. Tap to switch sound on" : "Sound is on. Tap to mute");
    b.setAttribute("aria-pressed", String(muted));
  }

  /** Show or hide the MENU button (shown with the docked buttons). */
  showMenuButton(show: boolean): void {
    if (this.menuBtn) this.menuBtn.hidden = !show;
  }

  set(info: StatusInfo): void {
    const key = `${info.credits}|${info.fuel}|${info.tank}|${JSON.stringify(info.location)}|${this.root.clientWidth}`;
    if (key === this.last) return; // nothing changed, skip the work
    this.last = key;
    this.credits.textContent = formatCredits(info.credits).replace(/ CR$/, "");
    this.fuelText.textContent = formatFuel(info.fuel, info.tank);
    this.fuelFill.style.width = `${(fuelFraction(info.fuel, info.tank) * 100).toFixed(0)}%`;
    this.fuelBar.classList.toggle("ui-low", fuelIsLow(info.fuel, info.tank));
    this.lastLocation = info.location;
    this.fitLocation();
  }
}

// ------------------------------------------------------------------ speaker button look

export type SpeakerStyle = "A" | "B" | "C";
/** Which look Andy chose (options A/B/C, 2026-11-11). */
export const SPEAKER_STYLE: SpeakerStyle = "B";

/** The button's words for a style (A: words only, B: picture only, C: picture and a word). */
export function speakerLabel(muted: boolean, style: SpeakerStyle): string {
  if (style === "A") return muted ? "SOUND OFF" : "SOUND ON";
  if (style === "C") return muted ? "MUTED" : "SOUND";
  return "";
}

/** A chunky pixel speaker drawn with squares (no image file). Muted: a cross instead of the sound waves. */
function speakerIcon(muted: boolean): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 12 10");
  svg.setAttribute("class", "ui-speaker-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("shape-rendering", "crispEdges");
  const cells: [number, number, number, number][] = [
    [0, 3, 2, 4], // back of the speaker
    [2, 2, 1, 6],
    [3, 1, 1, 8],
    [4, 0, 1, 10], // cone
  ];
  const marks: [number, number, number, number][] = muted
    ? [[7, 2, 1, 1], [8, 3, 1, 1], [9, 4, 1, 1], [10, 5, 1, 1], [11, 6, 1, 1], [7, 6, 1, 1], [8, 5, 1, 1], [10, 3, 1, 1], [11, 2, 1, 1]]
    : [[6, 4, 1, 2], [8, 2, 1, 1], [9, 3, 1, 4], [8, 7, 1, 1], [10, 0, 1, 1], [11, 1, 1, 8], [10, 9, 1, 1]];
  for (const [x, y, w, h] of [...cells, ...marks]) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", String(w));
    r.setAttribute("height", String(h));
    r.setAttribute("fill", "currentColor");
    svg.append(r);
  }
  return svg;
}

function speakerContent(muted: boolean, style: SpeakerStyle): Node[] {
  const label = speakerLabel(muted, style);
  const out: Node[] = [];
  if (style !== "A") out.push(speakerIcon(muted));
  if (label) out.push(el("span", "ui-speaker-word", label));
  return out;
}
