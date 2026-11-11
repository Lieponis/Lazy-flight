// THE DOCK NAME TAGS (stage U3, option B): small text labels floating above the planets that have a dock. Plain HTML text on top of
// the picture (like the other labels, not pixelated), moved every frame to follow its planet. They never catch taps.

import "./systemview.css";
import { spreadTags, type TagBox } from "./systemlayout";

export interface TagSpec {
  text: string;
  /** "OUTPOST" or "STATION": picks a small shape in front of the name. */
  kind: string;
}

export class SystemTags {
  private root = document.createElement("div");
  private items: { el: HTMLDivElement; width: number }[] = [];

  constructor(parent: HTMLElement) {
    this.root.className = "sys-tags";
    this.root.style.display = "none";
    parent.appendChild(this.root);
  }

  /** Replaces all tags. */
  set(specs: readonly TagSpec[]): void {
    this.root.replaceChildren();
    this.items = specs.map((spec) => {
      const el = document.createElement("div");
      el.className = `sys-tag sys-tag-${spec.kind.toLowerCase()}`;
      el.textContent = spec.text;
      this.root.appendChild(el);
      return { el, width: Math.max(40, spec.text.length * 9 + 22) };
    });
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "" : "none";
  }

  /**
   * Puts each tag at a spot on the picture (pixels, `null` = hide this tag). `x` = middle, `y` = where the tag's bottom edge
   * should be. `height` = picture height, to keep tags inside.
   */
  place(spots: readonly ({ x: number; y: number } | null)[], height: number): void {
    const boxes: TagBox[] = [];
    const ids: number[] = [];
    this.items.forEach((item, i) => {
      const spot = spots[i];
      if (!spot) {
        item.el.style.display = "none";
        return;
      }
      item.el.style.display = "";
      boxes.push({ x: spot.x, y: spot.y, w: item.width, h: 22 });
      ids.push(i);
    });
    const ys = spreadTags(boxes, height);
    ids.forEach((id, k) => {
      const item = this.items[id];
      const box = boxes[k];
      if (!item || !box) return;
      item.el.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(ys[k] ?? box.y)}px) translate(-50%, -100%)`;
    });
  }

  dispose(): void {
    this.root.remove();
  }
}
