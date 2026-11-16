// THE LONG-NAME PREVIEW (a testing aid for stage 3i): open the game with ?namepreview=1 for a sheet of cockpit information screens
// showing real and worst-case names, with buttons A / B / C to compare how long names are laid out. It draws with the very same
// code as the cockpit (drawInfo), on flat pictures, so nothing here depends on the 3D view. Nothing here is part of the real game.

import { drawInfo } from "./infoscreen";
import { formatCountdown } from "./flightplan";
import { NAME_STYLES, type NameStyle } from "./namefit";
import type { NameSample } from "./namesamples";
import { SCREEN_PIXEL_WIDTH, canvasHeightFor, type InfoScreenData } from "./screendata";

export interface NamePreviewOptions {
  initial: NameStyle;
  samples: readonly NameSample[];
}

const STYLE_TEXT: Record<NameStyle, string> = {
  A: "A: the whole name, text gets smaller when the name is long",
  B: "B: readable text, a very long name is shortened with ... and keeps its code",
  C: "C: name on top, place and code below it in blue",
};

/** The cockpit screen is 0.335 wide and 0.38 tall (src/render/assets/cockpitBase.ts), and the picture is stretched to it. */
const SCREEN_ASPECT = 1.135;
/** The picture width on this page: BIG for reading, GAME about as small as a screen is in the game's low-resolution picture. */
const SIZES = { BIG: 288, GAME: 96 } as const;
type SizeName = keyof typeof SIZES;

function dataFor(sample: NameSample): InfoScreenData {
  const tour = /^(NEXT|FINAL) STOP (\d+)\/(\d+)$/.exec(sample.heading);
  return {
    destination: sample.text,
    countdown: formatCountdown(161_000),
    phase: "APPROACH",
    page: "status",
    message: "",
    next: tour ? { number: Number(tour[2]), total: Number(tour[3]), name: sample.text, isFinal: tour[1] === "FINAL" } : null,
  };
}

/** Puts the preview sheet on the page. Returns a function that removes it. */
export function mountNamePreview(parent: HTMLElement, o: NamePreviewOptions): () => void {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;z-index:30;overflow:auto;background:#05060d;color:#d7dcff;font-family:var(--ui-font, monospace);font-size:18px;padding:max(10px, env(safe-area-inset-top)) 10px 40px;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;";
  const css = "font:inherit;min-width:44px;min-height:44px;border:2px solid #7fe7ff;cursor:pointer;touch-action:manipulation;";
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

  let style = o.initial;
  let size: SizeName = "BIG";
  const note = document.createElement("div");
  note.style.cssText = "margin:4px 0 10px;color:#7fe7ff;";
  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;";

  const canvases: { canvas: HTMLCanvasElement; sample: NameSample }[] = [];
  const draw = (): void => {
    for (const { canvas, sample } of canvases) {
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      drawInfo(ctx, canvas.width, canvas.height, dataFor(sample), style);
    }
    note.textContent = STYLE_TEXT[style];
  };
  const resize = (): void => {
    for (const { canvas } of canvases) {
      canvas.style.width = `${SIZES[size]}px`;
      canvas.style.height = `${Math.round(SIZES[size] * SCREEN_ASPECT)}px`;
    }
  };

  const styleButtons = new Map<NameStyle, HTMLButtonElement>();
  for (const s of NAME_STYLES) {
    const b = button(s, () => {
      style = s;
      for (const [k, btn] of styleButtons) paint(btn, k === style);
      draw();
    });
    styleButtons.set(s, b);
    bar.appendChild(b);
  }
  const sizeButton = button(`SIZE: ${size}`, () => {
    size = size === "BIG" ? "GAME" : "BIG";
    sizeButton.textContent = `SIZE: ${size}`;
    resize();
  });
  bar.appendChild(sizeButton);
  bar.appendChild(button("CLOSE", () => unmount()));

  for (const sample of o.samples) {
    const tile = document.createElement("div");
    tile.style.cssText = "max-width:300px;";
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_PIXEL_WIDTH;
    canvas.height = canvasHeightFor(SCREEN_PIXEL_WIDTH, 0.335, 0.38);
    canvas.style.cssText = "display:block;border:1px solid #2f8fa3;background:#0b3138;";
    const caption = document.createElement("div");
    caption.style.cssText = "font-size:15px;margin-top:3px;color:#9fb3c8;";
    caption.textContent = `${sample.label} - ${sample.text.length} letters: ${sample.text}`;
    tile.append(canvas, caption);
    grid.appendChild(tile);
    canvases.push({ canvas, sample });
  }

  const title = document.createElement("div");
  title.textContent = "LONG NAMES ON THE COCKPIT INFORMATION SCREEN";
  title.style.cssText = "margin-bottom:8px;color:#7fe7ff;";
  root.append(title, bar, note, grid);
  parent.appendChild(root);
  for (const [k, btn] of styleButtons) paint(btn, k === style);
  resize();
  draw();
  // The pixel font may still be loading: draw again when it is there.
  try {
    void document.fonts?.load(`20px "VT323"`).then(() => draw());
  } catch {
    // not important
  }

  function unmount(): void {
    root.remove();
  }
  return unmount;
}
