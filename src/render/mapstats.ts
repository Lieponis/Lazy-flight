// Testing aid for the galaxy map: ?mapstats=1 shows a small text block on the map with what it holds and what it costs
// (stars, diamonds, tappable, how long the star lookup and the sky took, and the FRAME line: milliseconds per picture, fps, JavaScript
// milliseconds, draw calls, triangles). Used for the phone speed check (stage G5a step 7). Off by default; nothing here runs without it.

/** True when the web address asks for the stats block (?mapstats=1). */
export function parseMapStats(search: string): boolean {
  const raw = new URLSearchParams(search).get("mapstats");
  return raw !== null && raw !== "0" && raw !== "off" && raw !== "false";
}

export interface MapStatsInput {
  stars: number;
  diamonds: number;
  tappable: number;
  radiusLy: number;
  zoomLimitLy: number;
  /** Width in light years of the diamond of an ordinary star (size class 1) here; shown so a screenshot proves which build it came from. */
  diamondLy?: number;
  /** Milliseconds the last star lookup and set-up took (once per move). */
  lookupMs: number;
  /** The last finished sky build (null = none yet), and whether one is being built now (0..1 progress, or null). */
  sky: { wallMs: number; glowMs: number; dotsMs: number; frames: number; worstSliceMs: number; squares: number; dots: number; cellLy: number } | null;
  skyProgress: number | null;
  /** Averaged milliseconds per picture, and the JavaScript share of it. */
  frameMs: number;
  jsMs: number;
  drawCalls: number;
  triangles: number;
}

function n(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** The text block. Pure, so it can be tested. */
export function mapStatsText(s: MapStatsInput): string {
  const diamondPart = s.diamondLy !== undefined ? `  diamond ${s.diamondLy.toFixed(2)} ly wide` : "";
  const lines = [
    `MAP  stars ${n(s.stars)}  diamonds ${n(s.diamonds)}${diamondPart}  tappable ${n(s.tappable)}  bubble ${n(s.radiusLy)} ly  zoom-out limit ${n(s.zoomLimitLy)} ly`,
    `STAR LOOKUP ${s.lookupMs.toFixed(0)} ms (once per move)`,
  ];
  if (s.skyProgress !== null) lines.push(`SKY building ${Math.round(s.skyProgress * 100)}%`);
  if (s.sky) {
    const k = s.sky;
    lines.push(
      `SKY built in ${k.wallMs.toFixed(0)} ms over ${k.frames} frames (glow work ${k.glowMs.toFixed(0)} ms + dots work ${k.dotsMs.toFixed(0)} ms, worst slice ${k.worstSliceMs.toFixed(1)} ms), ${n(k.squares)} squares, ${n(k.dots)} dots, cell ${n(k.cellLy)} ly`,
    );
  } else if (s.skyProgress === null) {
    lines.push("SKY none (the app gave no sky functions)");
  }
  lines.push(
    `FRAME ${s.frameMs.toFixed(1)} ms (${(1000 / Math.max(1, s.frameMs)).toFixed(0)} fps)  JS ${s.jsMs.toFixed(1)} ms  draw calls ${s.drawCalls}  triangles ${n(s.triangles)}`,
  );
  return lines.join("\n");
}

/** A small see-through text block in the top left corner. */
export function mountMapStats(parent: HTMLElement): HTMLPreElement {
  const el = document.createElement("pre");
  el.className = "map-stats";
  el.style.cssText =
    "position:fixed;left:4px;top:4px;margin:0;padding:3px 5px;max-width:96vw;white-space:pre-wrap;font:10px/1.25 monospace;color:#9fe;background:rgba(0,0,0,0.55);pointer-events:none;z-index:50;";
  parent.appendChild(el);
  return el;
}
