// The plain HTML text and buttons on top of the picture. Real menus are Agent 5's job.

import { setNameText } from "./nametext";
import "./hud.css";

export interface HudButton {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

export class Hud {
  private root: HTMLDivElement;
  private title: HTMLDivElement;
  private label: HTMLDivElement;
  private buttons: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.title = document.createElement("div");
    this.title.className = "hud-title";
    const bottom = document.createElement("div");
    bottom.className = "hud-bottom";
    this.label = document.createElement("div");
    this.label.className = "hud-label";
    this.buttons = document.createElement("div");
    this.buttons.className = "hud-buttons";
    bottom.append(this.label, this.buttons);
    this.root.append(this.title, bottom);
    parent.appendChild(this.root);
  }

  /** Hide or show the whole plain label and buttons (the flight screen has its own). */
  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "" : "none";
  }

  /**
   * The rows the text takes, in window pixels: where the title ends (top) and how much room the label and buttons take from the bottom.
   * The galaxy map keeps its edge markers clear of both. Zeros while the plain label is hidden (the flight screen).
   */
  freeRows(): { top: number; bottom: number } {
    if (this.root.style.display === "none") return { top: 0, bottom: 0 };
    const title = this.title.getBoundingClientRect();
    const bottom = this.label.parentElement?.getBoundingClientRect();
    return {
      top: this.title.textContent ? Math.max(0, title.bottom) : Math.max(0, title.top),
      bottom: bottom ? Math.max(0, window.innerHeight - bottom.top) : 0,
    };
  }

  setTitle(text: string): void {
    setNameText(this.title, text);
  }

  setLabel(text: string): void {
    setNameText(this.label, text);
  }

  setButtons(list: readonly HudButton[]): void {
    this.buttons.replaceChildren();
    for (const item of list) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.text;
      button.disabled = item.disabled === true;
      button.addEventListener("click", item.onClick);
      this.buttons.appendChild(button);
    }
  }
}
