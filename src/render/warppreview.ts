// THE WARP PREVIEW (a testing aid for 3e): open the game with ?warppreview=1 and it goes straight into an endless warp, with
// buttons A, B and C (or keys 1, 2, 3) to compare the three looks. Nothing here is part of the real game.

import { WARP_STYLES, type WarpStyle } from "./warpmath";

/** Puts the three buttons on the page. Returns a function that removes them. */
export function mountWarpPreview(parent: HTMLElement, initial: WarpStyle, onPick: (style: WarpStyle) => void): () => void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);top:calc(max(8px, env(safe-area-inset-top)) + var(--ui-top-reserve, 70px));z-index:9;display:flex;gap:8px;align-items:center;font-family:var(--ui-font, monospace);font-size:22px;color:#d7dcff;";
  const label = document.createElement("span");
  label.textContent = "WARP LOOK";
  bar.appendChild(label);
  const buttons = new Map<WarpStyle, HTMLButtonElement>();
  const pick = (style: WarpStyle): void => {
    onPick(style);
    for (const [s, b] of buttons) {
      b.style.background = s === style ? "#7fe7ff" : "#1a2040";
      b.style.color = s === style ? "#05060d" : "#d7dcff";
    }
  };
  for (const style of WARP_STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = style;
    b.style.cssText = "font:inherit;min-width:48px;min-height:44px;border:2px solid #7fe7ff;cursor:pointer;touch-action:manipulation;";
    b.addEventListener("click", () => pick(style));
    buttons.set(style, b);
    bar.appendChild(b);
  }
  const onKey = (e: KeyboardEvent): void => {
    const style = WARP_STYLES[Number(e.key) - 1];
    if (style) pick(style);
  };
  window.addEventListener("keydown", onKey);
  parent.appendChild(bar);
  pick(initial);
  return () => {
    window.removeEventListener("keydown", onKey);
    bar.remove();
  };
}
