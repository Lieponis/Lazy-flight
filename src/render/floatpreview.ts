// THE FLOAT PREVIEW (a testing aid for stage 3g): open the game with ?floatpreview=1 for buttons to compare the three
// layouts A / B / C of the "in space at a planet" scene, step through planets without a dock, try a free trip between
// two of them, a free trip that ends docked, and read the triangle count. Nothing here is part of the real game.

import { FLOAT_STYLES, floatLayout, type FloatStyle } from "./floatmath";

export interface FloatPreviewOptions {
  initial: FloatStyle;
  /** One text per planet the preview can show. */
  planets: readonly string[];
  onStyle: (style: FloatStyle) => void;
  onPlanet: (index: number) => void;
  /** Free trip from the shown planet to the next one in the list (or a dock). */
  onTrip: () => void;
  onTripToDock: () => void;
  triangles: () => number;
}

/** Puts the buttons on the page. Returns a function that removes them. */
export function mountFloatPreview(parent: HTMLElement, o: FloatPreviewOptions): () => void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);top:calc(max(8px, env(safe-area-inset-top)) + var(--ui-top-reserve, 70px) + 28px);z-index:9;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:96vw;font-family:var(--ui-font, monospace);font-size:18px;color:#d7dcff;";
  const css = "font:inherit;min-width:44px;min-height:40px;border:2px solid #7fe7ff;cursor:pointer;touch-action:manipulation;";
  const paint = (b: HTMLButtonElement, on: boolean): void => {
    b.style.background = on ? "#7fe7ff" : "#1a2040";
    b.style.color = on ? "#05060d" : "#d7dcff";
  };
  const button = (text: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = css;
    b.addEventListener("click", onClick);
    return b;
  };

  const styles = new Map<FloatStyle, HTMLButtonElement>();
  const note = document.createElement("span");
  note.style.cssText = "background:rgba(5,9,16,0.8);padding:2px 8px;";
  const pick = (style: FloatStyle): void => {
    o.onStyle(style);
    note.textContent = floatLayout(style).label;
    for (const [s, b] of styles) paint(b, s === style);
  };
  for (const style of FLOAT_STYLES) {
    const b = button(style, () => pick(style));
    styles.set(style, b);
    bar.appendChild(b);
  }
  bar.appendChild(note);

  let index = -1;
  const where = document.createElement("span");
  where.style.cssText = "min-width:12ch;text-align:center;background:rgba(5,9,16,0.8);padding:2px 8px;";
  const step = (delta: number): void => {
    if (o.planets.length === 0) return;
    index = (index + delta + o.planets.length) % o.planets.length;
    o.onPlanet(index);
    where.textContent = `${index + 1}/${o.planets.length} ${o.planets[index] ?? ""}`;
  };
  bar.appendChild(button("<", () => step(-1)));
  bar.appendChild(where);
  bar.appendChild(button(">", () => step(1)));
  bar.appendChild(button("TRIP", o.onTrip));
  bar.appendChild(button("TO DOCK", o.onTripToDock));

  const tris = document.createElement("span");
  tris.style.cssText = "background:rgba(5,9,16,0.8);padding:2px 8px;";
  bar.appendChild(tris);
  const timer = window.setInterval(() => {
    tris.textContent = `TRIS ${o.triangles()}`;
  }, 500);

  parent.appendChild(bar);
  pick(o.initial);
  where.textContent = "press > to step";
  return () => {
    window.clearInterval(timer);
    bar.remove();
  };
}
