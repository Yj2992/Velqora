"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ArrowUpRight, ScanFace, RefreshCw } from "lucide-react";
import { useApp, api } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, MetricCards, date, score } from "@/components/shared";
import type { Scan } from "@/lib/types";
export default function Results() {
  const { id } = useParams<{ id: string }>(),
    { data, demo, refresh } = useApp(),
    [scan, setScan] = useState<Scan | undefined>(
      data.scans.find((s) => s.id === id),
    ),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false),
    [pause, setPause] = useState(false),
    [image, setImage] = useState("");
  useEffect(() => {
    if (demo) {
      setScan(data.scans.find((s) => s.id === id));
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const start = Date.now();
    async function check() {
      try {
        const s = await api<Scan>("/api/scans/" + id);
        if (stopped) return;
        setScan(s);
        setError("");
        if (s.status === "completed") {
          void refresh();
        } else if (
          s.status === "processing" &&
          Date.now() - start < 180000 &&
          !pause
        )
          timer = setTimeout(check, 10000);
        else if (s.status === "processing") setPause(true);
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setPause(true);
        }
      }
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, demo, pause, refresh]);
  async function resume() {
    setChecking(true);
    setError("");
    try {
      const s = await api<Scan>("/api/scans/" + id);
      setScan(s);
      setPause(s.status === "timed_out");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  async function visuals() {
    try {
      const r = await api<Scan>("/api/scans/" + id + "?visualizations=true");
      setScan(r);
      if (!r.visualizations?.length)
        setError("No temporary provider visualizations are available.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function showImage() {
    try {
      const r = await api<{ url: string }>("/api/scans/" + id + "/image");
      setImage(r.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!scan)
    return (
      <>
        <PageHeader
          title="Your skin analysis"
          description={error || "Looking for your scan…"}
        />
        <div className="card empty-state">
          <ScanFace />
          <p>
            {demo
              ? "This sample scan was not found."
              : "Your authorized scan will appear here."}
          </p>
          <Button asChild variant="secondary">
            <Link href="/progress">Back to history</Link>
          </Button>
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow={demo ? "SYNTHETIC SAMPLE ANALYSIS" : "YOUR PERSONAL BASELINE"}
        title="A closer look at your skin."
        description={
          date(scan.created_at) + " · " + (demo ? "Demo data" : "YouCam v2.1")
        }
        action={
          scan.status === "completed" ? (
            <Button asChild>
              <Link href="/progress">
                Track my progress <ArrowUpRight size={16} />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {scan.status !== "completed" ? (
        <section className="card empty-state">
          <div className="empty-icon">
            {scan.status === "failed" ? (
              <ScanFace />
            ) : (
              <div className="loader" />
            )}
          </div>
          <h2>
            {scan.status === "failed"
              ? "This analysis couldn’t be completed"
              : scan.status === "timed_out" || pause
                ? "Your analysis needs a little longer"
                : "Getting to know your skin…"}
          </h2>
          <p>
            {scan.error_message ||
              "Your task is saved securely. This page checks for a result every 10 seconds."}
          </p>
          {["timed_out", "processing"].includes(scan.status) && (
            <Button onClick={() => void resume()} disabled={checking}>
              <RefreshCw size={16} />
              {checking ? "Checking…" : "Resume checking"}
            </Button>
          )}
          {scan.status === "failed" && (
            <Button asChild>
              <Link href="/scan">Try a new photograph</Link>
            </Button>
          )}
          <Link href="/dashboard" className="text-link">
            Return to your dashboard
          </Link>
        </section>
      ) : (
        <>
          <div className="result-summary card">
            <div className="result-seal">
              <Check size={22} />
              <span>Analysis complete</span>
            </div>
            <div>
              <span className="section-label">OVERALL SCORE</span>
              <strong className="result-number">
                {score(scan.overall_score)}
                <small>/100</small>
              </strong>
            </div>
            <div>
              <span className="section-label">SKIN AGE ESTIMATE</span>
              <strong className="result-word">{score(scan.skin_age)}</strong>
            </div>
            <div>
              <span className="section-label">REGIONAL SKIN TYPE</span>
              {scan.skin_type_results.length ? (
                scan.skin_type_results.map((t) => (
                  <p key={t.region}>
                    <span className="muted">{t.region}</span> · {t.skin_type}
                  </p>
                ))
              ) : (
                <p>Not returned</p>
              )}
            </div>
          </div>
          <div className="notice">
            These are cosmetic appearance measurements. Score direction has not
            been verified; changes are reported as increases or decreases,
            without claims of improvement.
          </div>
          {!demo && (
            <section className="card photo-panel">
              <div>
                <h2>Your scan photograph</h2>
                <p>Available only within the configured retention period.</p>
              </div>
              {image ? (
                <img src={image} alt="Original scan photograph" />
              ) : (
                <Button variant="secondary" onClick={() => void showImage()}>
                  View retained photo
                </Button>
              )}
            </section>
          )}
          <MetricCards scan={scan} />
          {!demo && (
            <section className="card" style={{ marginTop: 24 }}>
              <div className="card-heading">
                <h2>Provider visualizations</h2>
                <Button variant="secondary" onClick={() => void visuals()}>
                  Load temporary visualizations
                </Button>
              </div>
              <p className="subtle">
                These images come directly from YouCam and may expire. They are
                not retained by DermaLens.
              </p>
              <div className="metric-grid">
                {scan.visualizations?.map((v, i) => (
                  <figure key={i}>
                    <img
                      src={v.url}
                      alt={v.type + " provider visualization"}
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", borderRadius: 12 }}
                    />
                    <figcaption>{v.type}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
          <p className="subtle">
            Provider-generated masks are not retained. Temporary visualization
            links may expire. Missing measurements are shown as unavailable.
          </p>
        </>
      )}
    </>
  );
}
