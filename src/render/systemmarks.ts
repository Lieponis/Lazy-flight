// THE DOCK MARKS (stage U3), pure part: which look is used and the test links. Andy compares A, B and C.
//   OFF: the old look (every orbit line the same).
//   A  "Bright lanes": the orbit line of a planet with a dock is bright blue, scenery planets get a dim line.
//   B  "Name tags": A plus a small name tag floating above each dock planet.
//   C  "Beacons": A plus a little spinning diamond on a pin above each dock planet (no text).

export type MarkStyle = "off" | "A" | "B" | "C";
export const MARK_STYLES: readonly MarkStyle[] = ["off", "A", "B", "C"];

export interface MarkParts {
  lanes: boolean;
  tags: boolean;
  beacons: boolean;
}

export function markParts(style: MarkStyle): MarkParts {
  return { lanes: style !== "off", tags: style === "B", beacons: style === "C" };
}

/** ?marks=A|B|C|off from the web address, or null. */
export function parseMarks(search: string): MarkStyle | null {
  const m = /[?&]marks=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  if (v === "off") return "off";
  if (v === "a" || v === "b" || v === "c") return v.toUpperCase() as MarkStyle;
  return null;
}

/** ?systempreview=1 shows the buttons for comparing marks and stepping through systems (anything but 0 or false). */
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
