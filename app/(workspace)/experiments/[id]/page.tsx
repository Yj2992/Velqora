"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Check, ArrowRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, date, score } from "@/components/shared";
import { metricLabels } from "@/lib/types";
import { metricValue, delta } from "@/lib/progress";
export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>(),
    { data, logUsage, setStatus } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const e = data.experiments.find((e) => e.id === id);
  if (!e)
    return (
      <div className="card empty-state">
        <h2>This experiment is unavailable.</h2>
        <Link href="/experiments">Return to the lab</Link>
      </div>
    );
  const baseline = data.scans.find((s) => s.id === e.baseline_scan_id),
    follow = data.scans
      .filter(
        (s) =>
          s.status === "completed" &&
          s.id !== e.baseline_scan_id &&
          baseline &&
          s.created_at > baseline.created_at &&
          s.created_at.slice(0, 10) >= e.started_at &&
          (!e.ended_at || s.created_at.slice(0, 10) <= e.ended_at) &&
          s.provider_version === baseline.provider_version,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .at(-1),
    before = baseline ? metricValue(baseline, e.target_metric) : null,
    after = follow ? metricValue(follow, e.target_metric) : null,
    change = delta(before, after);
  async function log(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      await logUsage(id, String(f.get("date")), String(f.get("notes")));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function status(s: "active" | "paused" | "completed") {
    setBusy(true);
    setError("");
    try {
      await setStatus(id, s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="text-link back" href="/experiments">
        <ArrowLeft size={16} />
        Your experiments
      </Link>
      <PageHeader
        eyebrow={e.status.toUpperCase() + " EXPERIMENT"}
        title={e.title}
        description={
          e.product_name +
          " · " +
          e.frequency +
          " · Started " +
          date(e.started_at)
        }
        action={
          <Button
            disabled={busy}
            variant="secondary"
            onClick={() =>
              void status(e.status === "active" ? "completed" : "active")
            }
          >
            {e.status === "active" ? (
              <>
                <Check size={16} />
                Complete experiment
              </>
            ) : (
              "Resume experiment"
            )}
          </Button>
        }
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section className="card comparison-hero">
        <div>
          <span className="section-label">
            {(metricLabels[e.target_metric] || e.target_metric).toUpperCase()} ·
            OBSERVATION
          </span>
          <div className="comparison-scores">
            <strong>{score(before)}</strong>
            <ArrowRight />
            <strong>{score(after)}</strong>
          </div>
          <p>
            {follow
              ? "Baseline → latest follow-up"
              : "Baseline → awaiting a follow-up scan"}
          </p>
        </div>
        <div>
          <span className="pill lavender">
            {change
              ? `${change.points > 0 ? "+" : ""}${change.points} points`
              : "No comparison yet"}
          </span>
          <p>Numerical score change</p>
        </div>
      </section>
      <div className="notice">
        This change is an observation alongside your routine, not evidence that
        the product caused it. Camera conditions and other factors may
        contribute.
      </div>
      <div className="detail-grid">
        <section className="card">
          <div className="card-heading">
            <h2>Your usage journal</h2>
            <span className="pill neutral">
              {e.product_usage_logs?.length || 0} days
            </span>
          </div>
          {e.product_usage_logs?.length ? (
            e.product_usage_logs
              .sort((a, b) => b.usage_date.localeCompare(a.usage_date))
              .map((l) => (
                <div className="usage-log" key={l.id}>
                  <span className="log-dot" />
                  <div>
                    <strong>{date(l.usage_date)}</strong>
                    <p>{l.notes || "Product usage recorded."}</p>
                  </div>
                  <Check size={17} />
                </div>
              ))
          ) : (
            <p className="muted">Your first usage entry will appear here.</p>
          )}
          {e.notes && (
            <div className="experiment-notes">
              <span className="section-label">EXPERIMENT NOTES</span>
              <p>{e.notes}</p>
            </div>
          )}
        </section>
        <form className="card" onSubmit={log}>
          <h2>A small note for today.</h2>
          <p className="subtle">
            One entry per day. Saving again updates that day’s note.
          </p>
          <label className="field">
            Usage date
            <input
              type="date"
              name="date"
              required
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </label>
          <label className="field">
            What did you notice?
            <textarea
              rows={3}
              name="notes"
              maxLength={2000}
              placeholder="When did you use it? Anything worth remembering?"
            />
          </label>
          <Button disabled={busy || e.status !== "active"}>
            <Plus size={17} />
            {busy ? "Saving…" : "Log product usage"}
          </Button>
          {e.status === "active" && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void status("paused")}
            >
              Pause experiment
            </Button>
          )}
        </form>
      </div>
    </>
  );
}
