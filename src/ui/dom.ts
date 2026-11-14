import { splitCodes } from "./logic";

// Tiny helpers for making HTML elements.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", `ui-btn ${className}`.trim(), text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/**
 * Publishes how much room a bar takes as a CSS variable (in px), so other text can sit next to it
 * instead of under it. edge "top": distance from the top of the window to the bar's bottom.
 * edge "bottom": distance from the bar's top to the bottom of the window. Hidden bar = 0px.
 * Returns a function to call again after showing or hiding the bar.
 */
export function publishRoom(node: HTMLElement, cssVar: string, edge: "top" | "bottom"): () => void {
  const apply = (): void => {
    const rect = node.getBoundingClientRect();
    let px = 0;
    if (rect.height > 0) px = edge === "top" ? rect.bottom : window.innerHeight - rect.top;
    document.documentElement.style.setProperty(cssVar, `${Math.max(0, Math.ceil(px))}px`);
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(apply).observe(node);
  window.addEventListener("resize", apply);
  apply();
  return apply;
}

/**
 * Puts `full` into a one-line element; if it does not fit, asks `shorten(maxLetters)` for a shorter text (N3a: long
 * names keep their code). The game font is monospace, so letters are all the same width. The full text stays in the
 * title (shown on long-press or hover). Returns the text shown.
 */
export function fitText(node: HTMLElement, full: string, shorten: (maxLetters: number) => string): string {
  node.textContent = full;
  node.title = full;
  const room = node.clientWidth;
  if (room <= 0 || node.scrollWidth <= room) return full;
  let max = Math.max(4, Math.floor((full.length * room) / node.scrollWidth) - 1);
  let shown = shorten(max);
  node.textContent = shown;
  // A couple of tries in case the estimate was a letter or two off.
  for (let i = 0; i < 6 && node.scrollWidth > room && max > 4; i++) {
    max -= 2;
    shown = shorten(max);
    node.textContent = shown;
  }
  return shown;
}

/**
 * Sets text that may hold long names: it wraps normally, but each system code stays whole on one line (N3a: a phone
 * once broke "RP5N3-MVRJR" at its hyphen). Text only, never HTML.
 */
export function setNameText(node: HTMLElement, text: string): void {
  node.replaceChildren(
    ...splitCodes(text).map((part) => {
      if (!part.code) return document.createTextNode(part.text);
      const code = document.createElement("span");
      code.className = "ui-code";
      code.textContent = part.text;
      return code;
    }),
  );
}

/** el() for text with names: codes stay whole (see setNameText). */
export function nameEl<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const node = el(tag, className);
  setNameText(node, text);
  return node;
}
