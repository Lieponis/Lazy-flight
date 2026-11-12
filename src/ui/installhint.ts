// INSTALL HINT (stage P3, Agent 5g; Andy chose A: a small card at the bottom, above the buttons, with ✕).
// Once only, per device: "Play offline: Share > Add to Home Screen" (iPhone/iPad Safari) or "Install" (Android,
// using the browser's own install prompt when it offers one). Never on a computer.
// In the installed app instead, once: "Your progress from the browser is not here: SAVE FILE > IMPORT".
// Shown only at a safe moment (docked, no menu open, no trip). The "seen" flags live in their own storage slot
// (lazy-freight.hints), not in the save: each device shows its own hints once.

import type { StorageLike } from "../save";
import { button, el } from "./dom";
import { HINTS_KEY, HINT_TEXT, deviceKind, hintToShow, parseHints, type HintsSeen } from "./savefilelogic";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export class InstallHint {
  private root = el("div", "ui-installhint");
  private text = el("div", "ui-installhint-text");
  private installBtn: HTMLButtonElement;
  private seen: HintsSeen;
  private promptEvent: InstallPromptEvent | null = null;
  private showing: ReturnType<typeof hintToShow> = null;

  constructor(parent: HTMLElement, private storage: StorageLike | null) {
    this.seen = parseHints(this.read());
    this.installBtn = button("INSTALL", "ui-btn-primary", () => void this.install());
    this.installBtn.hidden = true;
    const close = button("✕", "ui-installhint-close", () => this.dismiss());
    close.setAttribute("aria-label", "Close this hint");
    this.root.append(this.text, this.installBtn, close);
    this.root.hidden = true;
    this.root.setAttribute("role", "status");
    parent.appendChild(this.root);
    // Android Chrome: keep the browser's own install offer for our INSTALL button.
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.promptEvent = e as InstallPromptEvent;
    });
    window.addEventListener("appinstalled", () => this.dismiss());
  }

  /** Call often (screen changes, a few times a second): shows or hides the card. */
  update(safeMoment: boolean): void {
    const nav = navigator as Navigator & { standalone?: boolean };
    const installed = window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
    const which = hintToShow(deviceKind(navigator.userAgent, navigator.maxTouchPoints), installed, this.seen, safeMoment);
    if (which === this.showing) return;
    this.showing = which;
    this.root.hidden = which === null;
    if (which === null) return;
    this.text.textContent = HINT_TEXT[which];
    this.installBtn.hidden = !(which === "install-android" && this.promptEvent !== null);
  }

  private async install(): Promise<void> {
    const e = this.promptEvent;
    this.promptEvent = null;
    if (e) {
      try {
        await e.prompt();
      } catch {
        // the browser said no: nothing else to do
      }
    }
    this.dismiss();
  }

  /** Never again on this device. */
  private dismiss(): void {
    if (this.showing === "app-tip") this.seen = { ...this.seen, appTipSeen: true };
    else this.seen = { ...this.seen, installHintSeen: true };
    this.write();
    this.showing = null;
    this.root.hidden = true;
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(HINTS_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private write(): void {
    try {
      this.storage?.setItem(HINTS_KEY, JSON.stringify(this.seen));
    } catch {
      // storage full or off: the hint may show once more next time, which is harmless
    }
  }
}
