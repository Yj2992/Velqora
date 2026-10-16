import type { Scan, Metric } from "./types";
export const round = (n: number) => Math.round(n * 100) / 100;
export function delta(
  previous: number | null | undefined,
  current: number | null | undefined,
) {
  if (
    previous == null ||
    current == null ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current)
  )
    return null;
  return {
    points: round(current - previous),
    percent:
      previous === 0
        ? null
        : round(((current - previous) / Math.abs(previous)) * 100),
  };
}
export function metricValue(scan: Scan, type: string, region = "whole") {
  if (type === "all") return scan.overall_score;
  return (
    scan.skin_scan_metrics.find(
      (m) => m.metric_type === type && m.region === region,
    )?.ui_score ?? null
  );
}
export function compare(a: Scan, b: Scan) {
  if (
    a.status !== "completed" ||
    b.status !== "completed" ||
    a.provider_version !== b.provider_version
  )
    return [];
  const keys = new Map<string, Metric>();
  [...a.skin_scan_metrics, ...b.skin_scan_metrics].forEach((m) =>
    keys.set(m.metric_type + "|" + m.region, m),
  );
  return [...keys.values()].map((m) => ({
    ...m,
    before: metricValue(a, m.metric_type, m.region),
    after: metricValue(b, m.metric_type, m.region),
    change: delta(
      metricValue(a, m.metric_type, m.region),
      metricValue(b, m.metric_type, m.region),
    ),
  }));
}
export function series(scans: Scan[], type: string, region = "whole") {
  return scans
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s) => ({
      id: s.id,
      date: s.created_at,
      score: metricValue(s, type, region),
    }));
}
export function deterministicSummary(scans: Scan[]) {
  const completed = scans
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!completed.length)
    return "Complete your first analysis to establish a baseline. No measurements are available yet.";
  if (completed.length === 1)
    return `Your scan establishes a baseline with ${completed[0].skin_scan_metrics.length} recorded measurements. A follow-up scan is needed to describe changes.`;
  const a = completed.at(-2)!,
    b = completed.at(-1)!;
  const change =
    a.provider_version === b.provider_version
      ? delta(a.overall_score, b.overall_score)
      : null;
  return `Your last two scans contain ${compare(a, b).filter((m) => m.change).length} comparable measurements.${change ? " The overall score changed by " + (change.points > 0 ? "+" : "") + change.points + " points." : ""} Differences may reflect lighting, pose, or routine changes. These observations do not establish product effectiveness or medical improvement.`;
}
