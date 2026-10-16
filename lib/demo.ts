import type { AppData, Scan, Experiment } from "./types";
import { actions } from "./types";
export function demoData(): AppData {
  const scans: Scan[] = Array.from({ length: 6 }, (_, i) => ({
    id: "demo-scan-" + i,
    status: "completed",
    overall_score: [64.2, 65.8, 65.1, 68.3, 69.2, 70.8][i],
    skin_age: 28,
    created_at: new Date(Date.UTC(2026, 8, 9 + i * 7, 8)).toISOString(),
    completed_at: new Date(Date.UTC(2026, 8, 9 + i * 7, 8)).toISOString(),
    provider_version: "synthetic-v1",
    capture_notes: "Synthetic demo • consistent lighting",
    skin_type_results: [
      { region: "whole", skin_type: "Combination" },
      { region: "T-zone", skin_type: "Oily" },
      { region: "U-zone", skin_type: "Normal" },
    ],
    skin_scan_metrics: actions
      .filter((a) => a !== "skin_type")
      .map((a, j) => ({
        metric_type: a,
        region: "whole",
        ui_score: Math.round(
          48 + ((j * 7) % 43) + i * (j % 3 === 0 ? 1.6 : 0.9),
        ),
        raw_score: null,
      })),
  }));
  const experiments: Experiment[] = [
    {
      id: "demo-exp-1",
      title: "A little more hydration",
      product_name: "Daily barrier moisturizer",
      target_metric: "moisture",
      baseline_scan_id: "demo-scan-2",
      status: "active",
      started_at: "2026-09-23",
      ended_at: null,
      frequency: "Daily",
      notes: "Keeping the rest of my routine consistent.",
      created_at: "2026-09-23T08:00:00Z",
      product_usage_logs: [
        {
          id: "demo-log-1",
          usage_date: "2026-10-14",
          notes: "Applied after cleansing this morning.",
        },
      ],
    },
  ];
  return {
    scans,
    experiments,
    insights: [],
    profile: { display_name: "Alex" },
    consent: true,
    llmConsent: false,
  };
}
