// The plain HTML text and buttons on top of the picture. Real menus are Agent 5's job.

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

  setTitle(text: string): void {
    this.title.textContent = text;
  }

  setLabel(text: string): void {
    this.label.textContent = text;
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
