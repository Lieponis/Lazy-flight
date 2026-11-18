// Agent 5j: one small line on the galaxy map that says what the diamonds and dots mean (Andy chose B).
// It sits just above the map's text label (drawn by the render layer, `.hud-label`) and follows its size,
// so it never covers the hint or the tapped star's name.
import { el } from "./dom";
import { MAP_LEGEND } from "./logic";

export class MapLegend {
  private readonly root: HTMLElement;
  private watched: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = el("div", "ui-map-legend", MAP_LEGEND);
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Show on the galaxy map only (not with a menu open). Call on every screen change. */
  update(show: boolean): void {
    this.root.hidden = !show;
    if (show) this.place();
  }

  private place(): void {
    const label = document.querySelector<HTMLElement>(".hud-label");
    if (label && label !== this.watched && typeof ResizeObserver !== "undefined") {
      this.watched = label;
      new ResizeObserver(() => {
        if (!this.root.hidden) this.place();
      }).observe(label);
    }
    const top = label && label.offsetParent !== null ? label.getBoundingClientRect().top : 0;
    this.root.style.bottom = top > 0 ? `${Math.ceil(window.innerHeight - top + 4)}px` : "";
  }
}
