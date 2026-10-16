"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api, useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty, date } from "@/components/shared";
import { metricLabels } from "@/lib/types";
export default function CreateExperiment() {
  const { data, createExperiment } = useApp(),
    router = useRouter(),
    scans = data.scans.filter((s) => s.status === "completed"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [baseline, setBaseline] = useState(scans.at(-1)?.id || ""),
    [metric, setMetric] = useState("moisture"),
    [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const scan = scans.find((s) => s.id === p.get("scan"));
    if (scan) {
      setBaseline(scan.id);
      const m = scan.skin_scan_metrics.find(
        (m) =>
          m.metric_type === p.get("metric") &&
          m.region === "whole" &&
          m.ui_score !== null,
      );
      if (m) setMetric(m.metric_type);
    }
    const id = p.get("product");
    if (id)
      void api<{ id: string; name: string }>(
        "/api/products/" + encodeURIComponent(id),
      )
        .then(setProduct)
        .catch((e) => setError((e as Error).message));
  }, []);
  const available =
    data.scans
      .find((s) => s.id === baseline)
      ?.skin_scan_metrics.filter(
        (m) => m.region === "whole" && m.ui_score != null,
      ) || [];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const id = await createExperiment({
        title: String(f.get("title")),
        product_name: product?.name || String(f.get("product_name")),
        product_id: product?.id || null,
        target_metric: metric,
        baseline_scan_id: baseline,
        started_at: String(f.get("started_at")),
        frequency: String(f.get("frequency")),
        notes: String(f.get("notes")),
      });
      router.push("/experiments/" + id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="text-link back" href="/experiments">
        <ArrowLeft size={16} />
        Experiment lab
      </Link>
      <PageHeader
        title="Start with one small change."
        description="A product, a baseline, and a little curiosity. That’s all you need."
      />
      {!scans.length ? (
        <Empty
          title="First, establish your baseline."
          text="A completed skin scan gives your experiment a starting point."
        />
      ) : (
        <form className="card form-card" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              Experiment name
              <input
                name="title"
                required
                minLength={2}
                maxLength={120}
                placeholder="My hydration routine"
              />
            </label>
            <label className="field">
              Product name
              <input
                name="product_name"
                required
                minLength={2}
                maxLength={240}
                key={product?.id || "custom"}
                defaultValue={product?.name || ""}
                readOnly={Boolean(product)}
                placeholder="Daily barrier moisturizer"
              />
            </label>
            {product && (
              <p className="notice">
                Linked to the verified product catalog.{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setProduct(null)}
                >
                  Use a custom product instead
                </button>
              </p>
            )}
            <label className="field">
              Baseline scan
              <select
                value={baseline}
                onChange={(e) => {
                  setBaseline(e.target.value);
                  const s = scans.find((s) => s.id === e.target.value);
                  setMetric(
                    s?.skin_scan_metrics.find(
                      (m) => m.region === "whole" && m.ui_score != null,
                    )?.metric_type || "moisture",
                  );
                }}
              >
                {scans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {date(s.created_at)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Target measurement
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {available.map((m) => (
                  <option key={m.metric_type} value={m.metric_type}>
                    {metricLabels[m.metric_type] || m.metric_type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Start date
              <input
                name="started_at"
                type="date"
                required
                defaultValue={new Date().toLocaleDateString("en-CA")}
              />
            </label>
            <label className="field">
              Usage frequency
              <select name="frequency">
                {["Daily", "Twice daily", "Weekly", "As needed"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Your notes <span className="optional">optional</span>
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              placeholder="What else is in your routine? What will you keep consistent?"
            />
          </label>
          <div className="notice">
            Record observations rather than conclusions. This experiment does
            not test or prove a product’s effectiveness.
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <Button disabled={busy || !available.length}>
            {busy ? "Creating…" : "Create experiment"}
            <ArrowRight size={17} />
          </Button>
        </form>
      )}
    </>
  );
}
