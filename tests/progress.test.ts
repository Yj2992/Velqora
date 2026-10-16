import { describe, it, expect } from "vitest";
import {
  delta,
  compare,
  metricValue,
  series,
  deterministicSummary,
} from "../lib/progress";
import { demoData } from "../lib/demo";
describe("Deterministic progress", () => {
  it("calculates signed changes and zero-safe percentages", () => {
    expect(delta(55, 63)).toEqual({ points: 8, percent: 14.55 });
    expect(delta(63, 55)?.points).toBe(-8);
    expect(delta(0, 8)).toEqual({ points: 8, percent: null });
    expect(delta(null, 63)).toBeNull();
  });
  it("does not compare missing metrics or incompatible providers", () => {
    const [a, b] = demoData().scans;
    b.skin_scan_metrics = [];
    expect(compare(a, b).every((m) => m.change === null)).toBe(true);
    b.provider_version = "other";
    expect(compare(a, b)).toEqual([]);
  });
  it("uses matching IDs and regions", () => {
    const [a, b] = demoData().scans;
    a.skin_scan_metrics = [
      { metric_type: "pore", region: "nose", ui_score: 55, raw_score: null },
    ];
    b.skin_scan_metrics = [
      { metric_type: "pore", region: "whole", ui_score: 63, raw_score: null },
    ];
    expect(compare(a, b).every((m) => m.change === null)).toBe(true);
    expect(metricValue(a, "pore")).toBeNull();
  });
  it("orders history and excludes failed scans", () => {
    const [a, b] = demoData().scans;
    expect(series([b, a], "all").map((s) => s.id)).toEqual([a.id, b.id]);
    b.status = "failed";
    expect(series([a, b], "all")).toHaveLength(1);
  });
  it("produces honest empty and baseline summaries", () => {
    expect(deterministicSummary([])).toContain("No measurements");
    expect(deterministicSummary([demoData().scans[0]])).toContain("baseline");
  });
});
