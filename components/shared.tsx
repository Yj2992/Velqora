"use client";
import { ArrowUpRight, ScanFace } from "lucide-react";
import Link from "next/link";
import type { Scan } from "@/lib/types";
import { metricLabels } from "@/lib/types";
import { Button } from "./ui/button";
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const score = (n: number | null | undefined) =>
  n == null ? "—" : Number(n.toFixed(1)).toString();
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "Your skin journey starts with one scan.",
  text = "Create a baseline. Then give your routine a little time to tell its story.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="card empty-state">
      <div className="empty-icon">
        <ScanFace size={36} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <Button asChild>
        <Link href="/scan">
          Start first analysis <ArrowUpRight size={17} />
        </Link>
      </Button>
    </div>
  );
}
export function MetricCards({ scan }: { scan: Scan }) {
  const groups = [
    {
      title: "Skin appearance",
      metrics: ["acne", "redness", "age_spot", "radiance"],
    },
    {
      title: "Skin characteristics",
      metrics: ["moisture", "oiliness", "pore", "texture", "firmness"],
    },
    {
      title: "Eye area",
      metrics: [
        "dark_circle_v2",
        "eye_bag",
        "tear_trough",
        "droopy_upper_eyelid",
        "droopy_lower_eyelid",
      ],
    },
    { title: "Age-related appearance", metrics: ["wrinkle"] },
  ];
  const known = groups.flatMap((g) => g.metrics);
  const extra = scan.skin_scan_metrics.filter(
    (m) => !known.includes(m.metric_type),
  );
  return (
    <>
      {groups.map((g) => (
        <section className="metric-group" key={g.title}>
          <div className="section-label">{g.title}</div>
          <div className="metric-grid">
            {g.metrics.map((type) => {
              const matches = scan.skin_scan_metrics.filter(
                (m) => m.metric_type === type,
              );
              return (
                <div className="card metric-card" key={type}>
                  <span>{metricLabels[type]}</span>
                  {matches.length ? (
                    matches.map((m) => (
                      <div key={m.region}>
                        <strong>{score(m.ui_score)}</strong>
                        <small>
                          {m.region === "whole"
                            ? "UI score"
                            : m.region + " · UI score"}
                        </small>
                        <details>
                          <summary>Raw measurement</summary>
                          {score(m.raw_score)}
                        </details>
                      </div>
                    ))
                  ) : (
                    <>
                      <strong>—</strong>
                      <small>Not returned by provider</small>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {extra.length > 0 && (
        <section className="metric-group">
          <div className="section-label">Additional provider measurements</div>
          <div className="metric-grid">
            {extra.map((m) => (
              <div className="card metric-card" key={m.metric_type + m.region}>
                <span>
                  {m.metric_type} · {m.region}
                </span>
                <strong>{score(m.ui_score)}</strong>
                <small>Raw: {score(m.raw_score)}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
