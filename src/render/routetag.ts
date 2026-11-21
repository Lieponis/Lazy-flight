// THE WORDS NEXT TO THE TARGET MARKER ("HOME, 1,240 ly") on the galaxy map (stage NAV-2).
//
// Plain words: the marker itself is a tiny picture inside the map; its words are ordinary text laid over the picture (like the
// title and the label), so they stay sharp and use the game's pixel font. The text sits next to the marker on the side that
// points into the picture, and is kept inside the free area (clear of the title on top and of the label and buttons at the bottom).

import { setNameText } from "./nametext";
import { tagPosition, type CssBounds, type EdgeSide } from "./routemath";
import "./route.css";

export class RouteTag {
  private readonly el: HTMLDivElement;
  private text = "";
  private w = 0;
  private h = 0;
  private shown = false;
  private lastKey = "";

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "route-tag";
    this.el.style.display = "none";
    parent.appendChild(this.el);
  }

  setText(text: string): void {
    if (text === this.text) return;
    this.text = text;
    setNameText(this.el, text);
    this.w = 0; // measured again when next shown
    this.lastKey = "";
  }

  /** Shows the words beside a marker at window pixel (x, y). */
  place(x: number, y: number, side: EdgeSide, bounds: CssBounds): void {
    if (!this.text) {
      this.hide();
      return;
    }
    if (!this.shown) {
      this.el.style.display = "block";
      this.shown = true;
      this.w = 0;
    }
    if (this.w === 0) {
      this.w = this.el.offsetWidth;
      this.h = this.el.offsetHeight;
    }
    const p = tagPosition(x, y, this.w, this.h, side, bounds);
    const key = `${Math.round(p.x)},${Math.round(p.y)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  }

  hide(): void {
    if (!this.shown) return;
    this.el.style.display = "none";
    this.shown = false;
    this.lastKey = "";
  }

  dispose(): void {
    this.el.remove();
  }
}
