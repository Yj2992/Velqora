"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ArrowUpRight, ScanFace, RefreshCw } from "lucide-react";
import { useApp, api } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, MetricCards, date, score } from "@/components/shared";
import type { Scan } from "@/lib/types";
import { FitzpatrickPanel } from "@/components/fitzpatrick-panel";
export default function Results() {
  const { id } = useParams<{ id: string }>(),
    { data, demo, refresh } = useApp(),
    [scan, setScan] = useState<Scan | undefined>(
      data.scans.find((s) => s.id === id),
    ),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false),
    [attempt, setAttempt] = useState(0),
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
    let failures = 0;
    setPause(false);
    async function check() {
      setChecking(true);
      try {
        const s = await api<Scan>("/api/scans/" + id);
        if (stopped) return;
        setScan(s);
        failures = 0;
        setError("");
        if (s.status === "completed") {
          void refresh();
        } else if (
          ["pending", "processing", "timed_out"].includes(s.status) &&
          Date.now() - start < 180000
        )
          timer = setTimeout(check, 10000);
        else if (["pending", "processing", "timed_out"].includes(s.status))
          setPause(true);
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          failures += 1;
          if (failures < 3 && Date.now() - start < 180000)
            timer = setTimeout(check, 10000);
          else setPause(true);
        }
      } finally {
        if (!stopped) setChecking(false);
      }
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, demo, attempt, refresh]);
  function resume() {
    setError("");
    setPause(false);
    setAttempt((value) => value + 1);
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
            {scan.status === "failed" || pause ? (
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
              (pause
                ? "Automatic checks are paused. Resume checking the saved task, or return to your dashboard."
                : "Your task is saved securely. This page checks every 10 seconds; you can leave and return without starting another scan.")}
          </p>
          {pause &&
            ["pending", "timed_out", "processing"].includes(scan.status) && (
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
            These are cosmetic appearance measurements. YouCam describes higher
            scores as more favorable; they are not clinical severity grades.
            Changes are reported as increases or decreases without attributing
            them to a product.
          </div>
          {!demo && (
            <section className="card photo-panel">
              <div>
                <h2>Your scan photograph</h2>
                <p>Available only within the configured retention period.</p>
              </div>
              {image ? (
                <img src={image} alt="Prepared scan photograph" />
              ) : (
                <Button variant="secondary" onClick={() => void showImage()}>
                  View retained photo
                </Button>
              )}
            </section>
          )}
          <section className="card scan-products-callout">
            <div>
              <span className="section-label">YOUR NEXT SMALL STEP</span>
              <h2>Turn observations into considered choices.</h2>
              <p>
                Use this scan to find skincare products across the web, with ingredient-based reasons and your preferences kept in view.
              </p>
            </div>
            <Button asChild>
              <Link href={"/products?scan=" + scan.id}>
                Find products for this scan <ArrowUpRight size={16} />
              </Link>
            </Button>
          </section>
          <MetricCards scan={scan} />
          <FitzpatrickPanel scanId={scan.id} demo={demo} />
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
                not retained by Velqora.
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
