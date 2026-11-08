// Small text helpers for showing times.

/** 12 -> "12s", 200 -> "3m 20s", 7200 -> "2h 00m". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h === 0) return `${m}m ${String(rest).padStart(2, "0")}s`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
