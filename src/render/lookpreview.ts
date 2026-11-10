// THE LOOK PREVIEW (a testing aid for 3e): open the game with ?lookpreview=1 for buttons Off / A / B / C to
// compare the pixel looks live, in any view. Nothing here is part of the real game.

import { LOOK_STYLES, type LookStyle } from "./lookmath";

/** Puts the buttons on the page. Returns a function that removes them. */
export function mountLookPreview(parent: HTMLElement, initial: LookStyle, onPick: (style: LookStyle) => void): () => void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(8px, env(safe-area-inset-bottom)) + 8px);z-index:9;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;font-family:var(--ui-font, monospace);font-size:22px;color:#d7dcff;";
  const label = document.createElement("span");
  label.textContent = "PIXEL LOOK";
  bar.appendChild(label);
  let style = initial;
  const buttons = new Map<LookStyle, HTMLButtonElement>();
  const paint = (b: HTMLButtonElement, on: boolean): void => {
    b.style.background = on ? "#7fe7ff" : "#1a2040";
    b.style.color = on ? "#05060d" : "#d7dcff";
  };
  const apply = (): void => {
    onPick(style);
    for (const [s, b] of buttons) paint(b, s === style);
  };
  const css = "font:inherit;min-width:48px;min-height:44px;border:2px solid #7fe7ff;cursor:pointer;touch-action:manipulation;";
  for (const s of LOOK_STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s === "off" ? "OFF" : s;
    b.style.cssText = css;
    b.addEventListener("click", () => {
      style = s;
      apply();
    });
    buttons.set(s, b);
    bar.appendChild(b);
  }
  parent.appendChild(bar);
  apply();
  return () => bar.remove();
}
