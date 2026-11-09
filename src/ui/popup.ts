// A small message card in the same style as the arrival card ("Delivered").
// Used for the emergency refuel line, and for shipyard messages ("Bought! Switch now?").
// A tap outside the card counts as the last button (or just closes it).

import { button, el } from "./dom";

export interface PopupButton {
  text: string;
  primary?: boolean;
  onClick?: () => void;
}

export interface PopupContent {
  title: string;
  /** Big amber line, e.g. "+20 FUEL". Optional. */
  big?: string;
  text: string;
  /** Default: one OK button. */
  buttons?: PopupButton[];
  /** Red title for failures. */
  warning?: boolean;
}

export class Popup {
  private root = el("div", "ui-popup");
  private card = el("div", "ui-panel ui-arrival-card");
  private outside: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root.setAttribute("role", "dialog");
    this.root.append(this.card);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target !== this.root) return;
      const action = this.outside;
      this.close();
      action?.();
    });
    parent.appendChild(this.root);
  }

  show(content: PopupContent): void {
    const title = el("div", "ui-panel-title", content.title);
    if (content.warning) title.classList.add("ui-red");
    const parts: HTMLElement[] = [title];
    if (content.big) parts.push(el("div", "ui-arrival-reward", content.big));
    parts.push(el("div", "ui-arrival-line", content.text));
    const defs = content.buttons && content.buttons.length > 0 ? content.buttons : [{ text: "OK", primary: true }];
    const row = el("div", "ui-popup-buttons");
    for (const b of defs) {
      row.append(
        button(b.text, b.primary ? "ui-btn-primary" : "", () => {
          this.close();
          b.onClick?.();
        }),
      );
    }
    parts.push(row);
    this.card.replaceChildren(...parts);
    this.outside = defs[defs.length - 1]?.onClick ?? null;
    this.root.hidden = false;
    this.root.setAttribute("aria-label", content.title);
  }

  close(): void {
    this.root.hidden = true;
    this.outside = null;
  }

  get opened(): boolean {
    return !this.root.hidden;
  }
}
