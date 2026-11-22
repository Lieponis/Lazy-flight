// THE SKY TEST TRIP (a testing aid for 3p): open the game with ?skytrip=1 and two buttons appear, TEST TRIP IN and TEST TRIP OUT. Each flies a
// pretend 40 second trip from the dock you are in to a real nearby system that lies towards the galaxy centre (or the rim), so you can watch the
// take-off, the flight, the landing and the docked view in under a minute. Nothing here is part of the real game and nothing is saved.

/** ?skytrip=1 in the web address (anything but 0 or false). */
export function parseSkyTrip(search: string): boolean {
  const v = new URLSearchParams(search).get("skytrip");
  return v !== null && v !== "0" && v.toLowerCase() !== "false";
}

/** Puts the two buttons on the page. Returns a function that removes them. */
export function mountSkyTrip(parent: HTMLElement, onTrip: (heading: "in" | "out") => void): () => void {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(8px, env(safe-area-inset-bottom)) + 70px);z-index:9;display:flex;gap:8px;align-items:center;font-family:var(--ui-font, monospace);font-size:20px;color:#d7dcff;";
  for (const heading of ["in", "out"] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `TEST TRIP ${heading.toUpperCase()}`;
    b.style.cssText = "font:inherit;min-height:44px;padding:0 10px;border:2px solid #7fe7ff;background:#1a2040;color:#d7dcff;cursor:pointer;touch-action:manipulation;";
    b.addEventListener("click", () => onTrip(heading));
    bar.appendChild(b);
  }
  parent.appendChild(bar);
  return () => bar.remove();
}
