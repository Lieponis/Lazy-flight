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
