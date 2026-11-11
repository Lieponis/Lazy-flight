// THE SYSTEM PREVIEW (a testing aid for stage U3): open the game with ?systempreview=1 for buttons to try the dock marks
// (OFF / A / B / C), step through systems with 1 to 10 planets, and read the triangle count. Nothing here is part of the real game.

import { MARK_STYLES, type MarkStyle } from "./systemmarks";

export interface SystemPreviewOptions {
  initial: MarkStyle;
  /** One text per system the preview can show, e.g. "Kopipex: 5 planets, 2 docks". */
  systems: readonly string[];
  onMark: (style: MarkStyle) => void;
  onSystem: (index: number) => void;
  triangles: () => number;
}

/** Puts the buttons on the page. Returns a function that removes them. */
export function mountSystemPreview(parent: HTMLElement, o: SystemPreviewOptions): () => void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);top:calc(max(8px, env(safe-area-inset-top)) + var(--ui-top-reserve, 70px) + 28px);z-index:9;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:96vw;font-family:var(--ui-font, monospace);font-size:20px;color:#d7dcff;";
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

  const marks = new Map<MarkStyle, HTMLButtonElement>();
  const pickMark = (style: MarkStyle): void => {
    o.onMark(style);
    for (const [s, b] of marks) paint(b, s === style);
  };
  const label = document.createElement("span");
  label.textContent = "DOCK MARKS";
  bar.appendChild(label);
  for (const style of MARK_STYLES) {
    const b = button(style === "off" ? "OFF" : style, () => pickMark(style));
    marks.set(style, b);
    bar.appendChild(b);
  }

  let index = -1;
  const where = document.createElement("span");
  where.style.cssText = "min-width:12ch;text-align:center;background:rgba(5,9,16,0.8);padding:2px 8px;";
  const step = (delta: number): void => {
    if (o.systems.length === 0) return;
    index = (index + delta + o.systems.length) % o.systems.length;
    o.onSystem(index);
    where.textContent = `${index + 1}/${o.systems.length} ${o.systems[index] ?? ""}`;
  };
  bar.appendChild(button("<", () => step(-1)));
  bar.appendChild(where);
  bar.appendChild(button(">", () => step(1)));

  const tris = document.createElement("span");
  tris.style.cssText = "background:rgba(5,9,16,0.8);padding:2px 8px;";
  bar.appendChild(tris);
  const timer = window.setInterval(() => {
    tris.textContent = `TRIS ${o.triangles()}`;
  }, 500);

  parent.appendChild(bar);
  pickMark(o.initial);
  where.textContent = "press > to step";
  return () => {
    window.clearInterval(timer);
    bar.remove();
  };
}
