// THE MARKERS AS A FINER LAYER above the galaxy map (stage NAV-2, after Andy's "all icons shake when rotating the view").
//
// Plain words: the stars are little 3D shapes, so their edges slide smoothly while the map turns. A marker that is a fixed pixel picture inside
// the map can only jump a whole big pixel at a time, so next to the stars it looks like it shakes. Here every marker is an ordinary small
// picture laid over the map, enlarged with hard edges (so it keeps the chunky look), and it is placed on the screen's own fine pixels:
// it glides as smoothly as the stars. At most about 60 of them; each frame only the positions are written.

import { GLYPHS, glyphTexels, type GlyphName, type MarkSink } from "./routeglyphs";
import { markerBox, type MarkerBox, type MarkerView } from "./routemath";
import { MAP_FAR_MARK_OPACITY } from "./settings";
import "./route.css";

const MAX_MARKS = 64;

interface Mark {
  el: HTMLImageElement;
  name: GlyphName | "";
  size: number;
  at: string;
  shown: boolean;
  dim: boolean;
}

export class MarkerOverlay implements MarkSink {
  private readonly root: HTMLDivElement;
  private readonly pool: Mark[] = [];
  private readonly urls = new Map<GlyphName, string>();
  private readonly box: MarkerBox = { left: 0, top: 0, size: 0, texelDevice: 1 };
  private view: MarkerView | null = null;
  private n = 0;
  private open = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "route-marks";
    this.root.style.display = "none";
    parent.appendChild(this.root);
  }

  /** Where the small picture is on the page. Call before the markers of a frame are added. */
  setView(view: MarkerView): void {
    this.view = view;
  }

  begin(): void {
    this.n = 0;
    if (!this.open) {
      this.root.style.display = "block";
      this.open = true;
    }
  }

  add(name: GlyphName, x: number, y: number, dim = false): void {
    const view = this.view;
    if (!view || this.n >= MAX_MARKS) return;
    const url = this.urlOf(name);
    if (!url) return;
    const texels = GLYPHS[name].rows.length + 2; // the picture plus its one-pixel edge
    const box = markerBox(view, x, y, texels, this.box);
    const mark = this.markAt(this.n++);
    if (mark.name !== name) {
      mark.name = name;
      mark.el.src = url;
    }
    if (mark.size !== box.size) {
      mark.size = box.size;
      mark.el.style.width = `${box.size}px`;
      mark.el.style.height = `${box.size}px`;
    }
    if (mark.dim !== dim) {
      mark.dim = dim;
      mark.el.style.opacity = dim ? String(MAP_FAR_MARK_OPACITY) : "";
    }
    const at = `translate3d(${box.left}px, ${box.top}px, 0)`;
    if (mark.at !== at) {
      mark.at = at;
      mark.el.style.transform = at;
    }
    if (!mark.shown) {
      mark.el.style.display = "block";
      mark.shown = true;
    }
  }

  end(): void {
    for (let i = this.n; i < this.pool.length; i++) {
      const mark = this.pool[i]!;
      if (mark.shown) {
        mark.el.style.display = "none";
        mark.shown = false;
      }
    }
  }

  /** Nothing to show (no plan, no place, or the map is not on screen). */
  clear(): void {
    this.n = 0;
    this.end();
    if (this.open) {
      this.root.style.display = "none";
      this.open = false;
    }
  }

  hide(): void {
    this.clear();
  }

  dispose(): void {
    this.root.remove();
    this.pool.length = 0;
  }

  private markAt(i: number): Mark {
    let mark = this.pool[i];
    if (!mark) {
      const el = document.createElement("img");
      el.className = "route-mark";
      el.alt = "";
      el.draggable = false;
      el.style.display = "none";
      this.root.appendChild(el);
      mark = { el, name: "", size: 0, at: "", shown: false, dim: false };
      this.pool[i] = mark;
    }
    return mark;
  }

  /** The marker's picture as a data address, made once per kind of marker. */
  private urlOf(name: GlyphName): string {
    const known = this.urls.get(name);
    if (known !== undefined) return known;
    let url = "";
    try {
      const t = glyphTexels(GLYPHS[name]);
      const canvas = document.createElement("canvas");
      canvas.width = t.size;
      canvas.height = t.size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(t.data), t.size, t.size), 0, 0);
        url = canvas.toDataURL("image/png");
      }
    } catch {
      url = "";
    }
    this.urls.set(name, url);
    return url;
  }
}
