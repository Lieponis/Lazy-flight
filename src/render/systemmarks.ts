// THE DOCK MARKS (stage U3), pure part. Andy chose option A ("bright lanes"): the orbit line of a planet with a dock is bright blue,
// scenery planets get a dim line. "off" is the old look (every line the same) and stays only for comparing.

export type MarkStyle = "off" | "A";
export const MARK_STYLES: readonly MarkStyle[] = ["off", "A"];

export interface MarkParts {
  lanes: boolean;
}

export function markParts(style: MarkStyle): MarkParts {
  return { lanes: style !== "off" };
}

/** ?marks=A|off from the web address, or null. */
export function parseMarks(search: string): MarkStyle | null {
  const m = /[?&]marks=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  if (v === "off") return "off";
  if (v === "a") return "A";
  return null;
}

/** ?systempreview=1 shows the buttons for stepping through systems (anything but 0 or false). */
export function parseSystemPreview(search: string): boolean {
  const m = /[?&]systempreview=([^&]*)/i.exec(search);
  if (!m) return false;
  const v = (m[1] ?? "").toLowerCase();
  return v !== "0" && v !== "false";
}

/**
 * The systems the preview steps through: up to `perCount` systems for each planet count (1 to 10), fewest planets first.
 * Input order is kept inside a count, so the list is the same every time.
 */
export function previewList<T extends { planetCount: number }>(systems: readonly T[], perCount = 2): T[] {
  const taken = new Map<number, number>();
  const out: T[] = [];
  for (const s of systems) {
    const n = taken.get(s.planetCount) ?? 0;
    if (n >= perCount) continue;
    taken.set(s.planetCount, n + 1);
    out.push(s);
  }
  return out.sort((a, b) => a.planetCount - b.planetCount);
}
