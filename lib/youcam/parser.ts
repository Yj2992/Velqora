import { z } from "zod";
import type { Metric, SkinType } from "../types";
const number = z.number().finite();
const entry = z
  .object({
    type: z.string().min(1),
    region: z.string().optional(),
    ui_score: number.nullish(),
    raw_score: number.nullish(),
    score: z
      .union([
        number,
        z.array(z.object({ region: z.string(), skin_type: z.string() })),
      ])
      .nullish(),
    skin_type: z
      .union([
        z.string(),
        z.array(z.object({ region: z.string(), skin_type: z.string() })),
      ])
      .nullish(),
    mask_urls: z.unknown().optional(),
    url: z.string().optional(),
  })
  .passthrough();
const envelope = z.object({
  status: z.number(),
  data: z.object({
    task_status: z.enum([
      "pending",
      "running",
      "processing",
      "success",
      "error",
      "failed",
    ]),
    results: z.object({ output: z.array(entry) }).optional(),
  }),
});
export function parseTask(value: unknown) {
  const p = envelope.parse(value);
  if (p.status !== 200)
    throw new Error("Provider returned an unsuccessful response");
  if (p.data.task_status === "error" || p.data.task_status === "failed")
    return { state: "failed" as const };
  if (p.data.task_status !== "success") return { state: "processing" as const };
  if (!p.data.results)
    throw new Error("Completed provider response has no output");
  const metrics: Metric[] = [],
    skinTypes: SkinType[] = [];
  let overall: number | null = null,
    age: number | null = null;
  const visuals: { type: string; url: string }[] = [];
  const seen = new Set<string>(),
    regions = new Set<string>();
  for (const e of p.data.results.output) {
    if (e.type === "all") {
      overall = e.ui_score ?? (typeof e.score === "number" ? e.score : null);
      continue;
    }
    if (e.type === "skin_age") {
      age = e.ui_score ?? (typeof e.score === "number" ? e.score : null);
      continue;
    }
    if (e.type === "skin_type") {
      const list = Array.isArray(e.skin_type)
        ? e.skin_type
        : Array.isArray(e.score)
          ? e.score
          : typeof e.skin_type === "string"
            ? [{ region: e.region ?? "whole", skin_type: e.skin_type }]
            : [];
      for (const t of list) {
        if (regions.has(t.region))
          throw new Error("Duplicate skin classification");
        regions.add(t.region);
        skinTypes.push(t);
      }
      continue;
    }
    if (e.type === "resize_image") {
      const candidates = [
        e.url,
        ...(Array.isArray(e.mask_urls)
          ? e.mask_urls
          : typeof e.mask_urls === "string"
            ? [e.mask_urls]
            : []),
      ];
      for (const u of candidates)
        if (typeof u === "string" && u.startsWith("https://"))
          visuals.push({ type: e.type, url: u });
      continue;
    }
    const masks = Array.isArray(e.mask_urls)
      ? e.mask_urls
      : typeof e.mask_urls === "string"
        ? [e.mask_urls]
        : [];
    for (const u of masks)
      if (typeof u === "string" && u.startsWith("https://"))
        visuals.push({
          type: e.type + (e.region ? " · " + e.region : ""),
          url: u,
        });
    const region = e.region ?? "whole",
      key = e.type + "|" + region;
    if (seen.has(key)) throw new Error("Duplicate provider metric");
    seen.add(key);
    metrics.push({
      metric_type: e.type,
      region,
      ui_score: e.ui_score ?? null,
      raw_score: e.raw_score ?? null,
    });
  }
  return {
    state: "completed" as const,
    metrics,
    skinTypes,
    overall,
    age,
    visuals,
  };
}
export const taskCreated = z.object({
  status: z.literal(200),
  data: z.object({ task_id: z.string().min(1) }),
});
