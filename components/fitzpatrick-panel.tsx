"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
type Estimate = {
  status: "pending" | "processing" | "completed" | "failed" | "timed_out";
  fitzpatrick_scale: "I" | "II" | "III" | "IV" | "V" | "VI" | null;
  error_message?: string | null;
};
export function FitzpatrickPanel({
  scanId,
  demo,
}: {
  scanId: string;
  demo: boolean;
}) {
  const [result, setResult] = useState<Estimate | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    if (demo) {
      setLoading(false);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setPaused(false);
    async function check() {
      try {
        const data = await api<Estimate | null>(
          `/api/scans/${scanId}/fitzpatrick`,
        );
        if (stopped) return;
        setResult(data);
        setError("");
        if (
          data &&
          ["pending", "processing", "timed_out"].includes(data.status)
        ) {
          if (Date.now() - started < 180000) timer = setTimeout(check, 10000);
          else setPaused(true);
        }
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setPaused(true);
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [scanId, demo, attempt]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const data = await api<Estimate>(`/api/scans/${scanId}/fitzpatrick`, {
        method: "POST",
        body: JSON.stringify({ consent }),
      });
      setResult(data);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active =
    result && ["pending", "processing", "timed_out"].includes(result.status);
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <span className="section-label">OPTIONAL SUN-RESPONSE ESTIMATE</span>
      <h2>Fitzpatrick skin type</h2>
      <p>
        This I–VI classification is separate from normal, dry or oily skin. A
        photo-based estimate cannot establish your actual history of burning or
        tanning.
      </p>
      {demo ? (
        <p className="notice">
          Available for real completed scans with a retained photo. No
          classification is invented in demo mode.
        </p>
      ) : loading ? (
        <p role="status">Checking for a saved estimate…</p>
      ) : result?.status === "completed" ? (
        <div>
          <strong className="result-word">
            Type {result.fitzpatrick_scale}
          </strong>
          <p className="subtle">YouCam AI estimate · Fitzpatrick V1.0</p>
          <p>
            Confirm this estimate against your own sun-response history. It does
            not determine a safe tanning time or replace professional advice.
          </p>
          <p>
            Sun protection matters for every skin tone: use shade, protective
            clothing and broad-spectrum, water-resistant SPF 30+ sunscreen.{" "}
            <a
              className="text-link"
              href="https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/practice-safe-sun"
              target="_blank"
              rel="noreferrer"
            >
              Sun-protection guidance
            </a>
          </p>
        </div>
      ) : result?.status === "failed" ? (
        <p className="error" role="alert">
          {result.error_message || "This estimate could not be completed."}
        </p>
      ) : active ? (
        <div>
          <p role="status">
            {paused
              ? "Automatic checks paused. Your task is saved."
              : "Checking your photo and estimating its Fitzpatrick category. You can leave this page and return later."}
          </p>
          {paused && (
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            >
              Resume checking
            </Button>
          )}
        </div>
      ) : (
        <div>
          <p>
            Uses the retained photo from this scan. YouCam lists 10 units per
            successful classification. This does not rerun your skin analysis.
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy}
            />
            <span>
              I agree to send this photo to YouCam for the additional
              Fitzpatrick analysis, save its result, and use the applicable
              units.
            </span>
          </label>
          <Button
            onClick={() => void start()}
            disabled={!consent || busy || loading}
          >
            {busy ? "Starting…" : "Add Fitzpatrick estimate · 10 units"}
          </Button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!demo && paused && !result && (
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          Retry connection
        </Button>
      )}
    </section>
  );
}
