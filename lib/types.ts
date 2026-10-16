export const actions = [
  "acne",
  "dark_circle_v2",
  "droopy_lower_eyelid",
  "droopy_upper_eyelid",
  "eye_bag",
  "firmness",
  "moisture",
  "oiliness",
  "pore",
  "radiance",
  "redness",
  "age_spot",
  "texture",
  "wrinkle",
  "skin_type",
  "tear_trough",
] as const;
export const metricLabels: Record<string, string> = {
  all: "Overall score",
  acne: "Acne",
  dark_circle_v2: "Dark circles",
  droopy_lower_eyelid: "Lower eyelids",
  droopy_upper_eyelid: "Upper eyelids",
  eye_bag: "Eye bags",
  firmness: "Firmness",
  moisture: "Moisture",
  oiliness: "Oiliness",
  pore: "Pores",
  radiance: "Radiance",
  redness: "Redness",
  age_spot: "Age spots",
  texture: "Texture",
  wrinkle: "Wrinkles",
  tear_trough: "Tear troughs",
};
export type Status =
  "pending" | "processing" | "completed" | "failed" | "timed_out" | "deleting";
export type Metric = {
  metric_type: string;
  region: string;
  ui_score: number | null;
  raw_score: number | null;
};
export type SkinType = { region: string; skin_type: string };
export type Scan = {
  id: string;
  status: Status;
  overall_score: number | null;
  skin_age: number | null;
  created_at: string;
  completed_at: string | null;
  error_message?: string | null;
  image_storage_path?: string | null;
  skin_scan_metrics: Metric[];
  skin_type_results: SkinType[];
  provider_version: string;
  capture_notes?: string;
  visualizations?: { type: string; url: string }[];
};
export type Experiment = {
  id: string;
  title: string;
  product_name: string;
  target_metric: string;
  baseline_scan_id: string;
  status: "active" | "completed" | "paused";
  started_at: string;
  ended_at: string | null;
  frequency: string;
  notes: string;
  created_at: string;
  product_usage_logs?: { id: string; usage_date: string; notes: string }[];
};
export type Insight = {
  id: string;
  question: string;
  response: string;
  created_at: string;
  source: "llm" | "deterministic";
};
export type AppData = {
  scans: Scan[];
  experiments: Experiment[];
  insights: Insight[];
  profile: { display_name: string };
  consent: boolean;
  llmConsent: boolean;
};
