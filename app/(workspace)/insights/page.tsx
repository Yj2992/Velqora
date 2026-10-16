"use client";
import { useState, useEffect } from "react";
import { Sparkles, ArrowUp, ScanFace } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
export default function Insights() {
  const { data, ask, demo } = useApp(),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scanIds, setScanIds] = useState<string[] | undefined>();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("a") && q.get("b")) setScanIds([q.get("a")!, q.get("b")!]);
  }, []);
  async function send(q = question) {
    if (!q.trim() || busy) return;
    setError("");
    setBusy(true);
    try {
      await ask(q.trim(), scanIds);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE SPACE FOR UNDERSTANDING"
        title="A little context for your skin story."
        description="Explore your measurements and routine with thoughtful, grounded explanations."
      />
      {scanIds && (
        <div className="notice">
          This conversation uses the two scans selected in your comparison.
        </div>
      )}
      <div className="insights-layout">
        <section className="card chat-card">
          <div className="chat-intro">
            <div className="insight-orb">
              <Sparkles size={27} />
            </div>
            <h2>What are you curious about?</h2>
            <p>
              Your recorded measurements are the starting point.
              <br />
              Your questions guide the conversation.
            </p>
          </div>
          <div className="suggestions">
            {[
              "What changed since my last scan?",
              "Explain my skin texture trend",
              "Summarize my skincare experiment",
            ].map((q) => (
              <button disabled={busy} onClick={() => void send(q)} key={q}>
                {q}
                <ArrowUp size={14} />
              </button>
            ))}
          </div>
          {data.insights.map((i) => (
            <div className="chat-pair" key={i.id}>
              <div className="chat-question">{i.question}</div>
              <div className="chat-answer">
                <Sparkles size={18} />
                <div>
                  <span className="section-label">
                    {i.source === "llm"
                      ? "AI EXPLANATION"
                      : "DETERMINISTIC SUMMARY"}
                  </span>
                  <p>{i.response}</p>
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-answer" aria-live="polite">
              <div className="loader small-loader" />
              <p>Reviewing your recorded measurements…</p>
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              aria-label="Ask about your skin measurements"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your skin story…"
              minLength={3}
              maxLength={1000}
              required
            />
            <Button
              disabled={busy || question.trim().length < 3}
              aria-label="Send question"
            >
              <ArrowUp size={20} />
            </Button>
          </form>
          <p className="subtle centered">
            {demo
              ? "Demo responses are deterministic summaries of synthetic data."
              : !data.llmConsent
                ? "External AI sharing is off. Responses use a labeled deterministic summary."
                : "AI explanations require a configured provider. Otherwise, a deterministic summary is labeled clearly."}
          </p>
        </section>
        <aside className="card insight-context">
          <ScanFace size={25} />
          <span className="section-label">YOUR CONTEXT</span>
          <h2>Grounded in your history.</h2>
          <div className="context-count">
            <strong>
              {data.scans.filter((s) => s.status === "completed").length}
            </strong>
            <span>completed scans</span>
          </div>
          <div className="context-count">
            <strong>{data.experiments.length}</strong>
            <span>routine experiments</span>
          </div>
          <p>
            We calculate changes in application code. The AI explains the
            supplied measurements.
          </p>
          <div className="divider" />
          <p>
            Photo conditions affect results. Routine associations don’t prove
            causation. For medical concerns, consult a qualified professional.
          </p>
        </aside>
      </div>
    </>
  );
}
