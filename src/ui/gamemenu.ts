// MENU: a small overlay over the docked view, same style as the Jobs menu.
// Shows the universe seed and whether saving works, and NEW GAME:
//   NEW GAME -> "Same universe" or "New random universe" -> "Really start over?" -> the page starts again.
// SETTINGS (Agent 7a, Andy's choice): a mute button and two volume sliders (music, sound effects).
// P3 (Agent 5g): a SAVE FILE button (opens src/ui/savefile.ts) with a one-line tip, and in SETTINGS a TESTER part:
// a speed choice stored under its own key and used after a reload (src/game/clock.ts startSpeed).

import type { SoundPrefs } from "../audio";
import { button, el } from "./dom";
import { Popup } from "./popup";
import { GAME_NAME } from "./titlelogic";
import { SAVE_FILE_TIP, TESTER_WARNING, TEST_SPEEDS, testSpeedLabel, testSpeedStatus } from "./savefilelogic";

/** MENU -> SETTINGS -> TESTER (P3): the stored tester speed and the speed the game runs at now. */
export interface TesterHooks {
  chosen(): number;
  choose(speed: number): void;
  running(): number;
  /** True when ?speed= in the web address decides the speed. */
  fromAddress(): boolean;
  reload(): void;
}

export interface MenuExtras {
  onSaveFile?: () => void;
  tester?: TesterHooks;
}

/** MENU -> SETTINGS reads and changes the sound settings through these (src/ui/sound.ts). */
export interface SoundSettingsHooks {
  get(): SoundPrefs;
  /** `save` false while a slider is still moving, true when it is let go. */
  set(prefs: SoundPrefs, save: boolean): void;
}

/** "MUSIC 50%" style label for a slider (0..1). */
export function volumeLabel(name: string, value: number): string {
  return `${name} ${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

/** Text of the mute button. */
export function muteButtonText(muted: boolean): string {
  return muted ? "SOUND: OFF" : "SOUND: ON";
}

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
  private sub = el("div", "ui-panel-sub", GAME_NAME);
  private mainView = el("div", "ui-menu-body");
  private settingsView = el("div", "ui-menu-body ui-settings");
  private muteBtn: HTMLButtonElement | null = null;
  private sliders: { key: "music" | "effects"; name: string; input: HTMLInputElement; label: HTMLElement }[] = [];

  constructor(
    parent: HTMLElement,
    private info: GameMenuInfo,
    private onNewGame: (choice: NewGameChoice) => void,
    private onClose: () => void,
    private onRanks?: () => void,
    private sound?: SoundSettingsHooks,
    private extras: MenuExtras = {},
  ) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Menu");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "MENU"), this.sub);
    head.append(titles, button("CLOSE", "", () => this.onClose()));
    const body = this.mainView;
    // RANKS (part 5c): your ranks and the outposts you own.
    if (this.onRanks) body.append(button("RANKS & OUTPOSTS", "ui-btn-primary ui-btn-wide", () => this.onRanks?.()));
    if (this.sound) body.append(button("SETTINGS", "ui-btn-primary ui-btn-wide", () => this.showSettings(true)));
    if (this.extras.onSaveFile) {
      body.append(button("SAVE FILE", "ui-btn-primary ui-btn-wide", () => this.extras.onSaveFile?.()), el("div", "ui-menu-tip", SAVE_FILE_TIP));
    }
    body.append(this.seedLine, this.saveLine, button("NEW GAME", "ui-btn-amber ui-btn-wide", () => this.askUniverse()));
    if (this.sound) this.buildSettings(this.sound);
    this.settingsView.hidden = true;
    panel.append(head, body, this.settingsView);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    parent.appendChild(this.root);
    this.popup = new Popup(parent);
  }

  private buildSettings(sound: SoundSettingsHooks): void {
    const v = this.settingsView;
    this.muteBtn = button(muteButtonText(false), "ui-settings-mute", () => {
      const p = sound.get();
      sound.set({ ...p, muted: !p.muted }, true);
      this.renderSettings();
    });
    this.muteBtn.setAttribute("aria-label", "Mute or unmute all sound");
    const row = el("div", "ui-settings-row");
    row.append(button("BACK", "", () => this.showSettings(false)), this.muteBtn);
    v.append(row);
    for (const [key, name] of [
      ["music", "MUSIC"],
      ["effects", "SOUND EFFECTS"],
    ] as const) {
      const label = el("label", "ui-menu-line ui-slider-label");
      const input = el("input", "ui-slider");
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.step = "1";
      input.setAttribute("aria-label", name);
      const read = (): SoundPrefs => ({ ...sound.get(), [key]: Number(input.value) / 100 });
      input.addEventListener("input", () => {
        sound.set(read(), false);
        label.textContent = volumeLabel(name, Number(input.value) / 100);
      });
      input.addEventListener("change", () => sound.set(read(), true));
      v.append(label, input);
      this.sliders.push({ key, name, input, label });
    }
    if (this.extras.tester) this.buildTester(this.extras.tester);
  }

  private testerButtons: { speed: number; btn: HTMLButtonElement }[] = [];
  private testerStatus = el("div", "ui-menu-line ui-tester-status");

  /** TESTER (P3, Andy's speeds): for testing in the installed app, where there is no address bar for ?speed=. */
  private buildTester(t: TesterHooks): void {
    const v = this.settingsView;
    const grid = el("div", "ui-tester-grid");
    for (const speed of TEST_SPEEDS) {
      const b = button(testSpeedLabel(speed), "ui-btn-wide", () => {
        t.choose(speed);
        this.renderSettings();
      });
      this.testerButtons.push({ speed, btn: b });
      grid.append(b);
    }
    v.append(
      el("div", "ui-tester-title", "TESTER"),
      el("div", "ui-menu-line ui-tester-warning", TESTER_WARNING),
      grid,
      this.testerStatus,
      button("RELOAD NOW", "ui-btn-wide", () => t.reload()),
    );
  }

  private showSettings(on: boolean): void {
    this.mainView.hidden = on;
    this.settingsView.hidden = !on;
    this.sub.textContent = on ? "SETTINGS · SOUND" : GAME_NAME;
    if (on) this.renderSettings();
  }

  private renderSettings(): void {
    if (!this.sound) return;
    const p = this.sound.get();
    if (this.muteBtn) {
      this.muteBtn.textContent = muteButtonText(p.muted);
      this.muteBtn.classList.toggle("ui-btn-red", p.muted); // red while muted, so it is easy to notice
    }
    for (const s of this.sliders) {
      s.input.value = String(Math.round(p[s.key] * 100));
      s.label.textContent = volumeLabel(s.name, p[s.key]);
    }
    const t = this.extras.tester;
    if (t) {
      const chosen = t.chosen();
      for (const { speed, btn } of this.testerButtons) btn.classList.toggle("ui-btn-on", speed === chosen);
      this.testerStatus.textContent = testSpeedStatus(chosen, t.running(), t.fromAddress());
    }
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
    this.showSettings(false); // MENU always opens on its main page
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
