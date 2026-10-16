"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ScanFace, ArrowRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty, date, score } from "@/components/shared";
import { TrendChart } from "@/components/charts";
import { metricLabels } from "@/lib/types";
export default function Progress() {
  const { data } = useApp(),
    [metric, setMetric] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const complete = data.scans.filter((s) => s.status === "completed"),
    scans = complete
      .filter(
        (s) =>
          (!from || s.created_at.slice(0, 10) >= from) &&
          (!to || s.created_at.slice(0, 10) <= to),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <PageHeader
        eyebrow="LOOK AT THE BIGGER PICTURE"
        title="Every scan is part of your story."
        description="Observe your measurements over time, with room for real-life variation."
        action={
          <Button asChild variant="secondary">
            <Link href="/progress/compare">
              Compare two scans <ArrowUpRight size={16} />
            </Link>
          </Button>
        }
      />
      {!data.scans.length ? (
        <Empty />
      ) : (
        <>
          <section className="card">
            <div className="card-heading">
              <h2>Your measurement history</h2>
              <span className="pill neutral">
                {scans.length} completed scans
              </span>
            </div>
            <div className="filters">
              <label className="field">
                Metric
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {Object.entries(metricLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="field">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <TrendChart scans={scans} metric={metric} />
            <p className="subtle">
              Missing measurements leave gaps in the chart. Use consistent
              lighting and pose to make comparisons more useful.
            </p>
          </section>
          <div className="section-heading">
            <h2>Your scan journal</h2>
            <Button asChild variant="ghost">
              <Link href="/scan">
                Add a scan <ScanFace size={17} />
              </Link>
            </Button>
          </div>
          <div className="scan-history">
            {data.scans
              .filter(
                (s) =>
                  (!from || s.created_at.slice(0, 10) >= from) &&
                  (!to || s.created_at.slice(0, 10) <= to),
              )
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((s, i) => (
                <Link
                  key={s.id}
                  href={"/scan/" + s.id}
                  className="card history-row"
                >
                  <div className="history-icon">
                    <ScanFace size={23} />
                  </div>
                  <div>
                    <strong>{date(s.created_at)}</strong>
                    <p>{s.capture_notes || "Skin analysis"}</p>
                  </div>
                  <span
                    className={
                      "pill " + (s.status === "completed" ? "sage" : "neutral")
                    }
                  >
                    {s.status.replace("_", " ")}
                  </span>
                  <div className="history-score">
                    <strong>{score(s.overall_score)}</strong>
                    <small>overall score</small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
          </div>
          {!scans.length && (
            <p className="notice">
              No completed measurements in this date range.
            </p>
          )}
        </>
      )}
    </>
  );
}
