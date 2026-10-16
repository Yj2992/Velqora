"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useApp, api } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty, date, score } from "@/components/shared";
import { compare, delta } from "@/lib/progress";
import { metricLabels } from "@/lib/types";
export default function Compare() {
  const { data, demo } = useApp(),
    scans = data.scans
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [aId, setA] = useState(scans[0]?.id || ""),
    [bId, setB] = useState(scans.at(-1)?.id || ""),
    [photos, setPhotos] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const a = scans.find((s) => s.id === aId),
    b = scans.find((s) => s.id === bId),
    rows = a && b ? compare(a, b) : [],
    overall =
      a && b && a.provider_version === b.provider_version
        ? delta(a.overall_score, b.overall_score)
        : null;
  async function photo(id: string) {
    try {
      const r = await api<{ url: string }>("/api/scans/" + id + "/image");
      setPhotos((p) => ({ ...p, [id]: r.url }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Link href="/progress" className="text-link back">
        <ArrowLeft size={16} />
        Your skin progress
      </Link>
      <PageHeader
        title="Two moments. A little perspective."
        description="Compare matching measurements. Let the numbers speak for themselves."
      />
      {scans.length < 2 ? (
        <Empty
          title="A second scan opens a new perspective."
          text="You need two completed scans to compare measurements."
        />
      ) : (
        <>
          <div className="compare-selectors">
            {[
              ["Earlier scan", aId, setA],
              ["Later scan", bId, setB],
            ].map(([label, id, set]) => (
              <label className="card field" key={label as string}>
                {label as string}
                <select
                  value={id as string}
                  onChange={(e) => (set as (s: string) => void)(e.target.value)}
                >
                  {scans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {date(s.created_at)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {aId === bId ? (
            <div className="notice">Choose two different scans.</div>
          ) : a && b ? (
            <>
              <div className="comparison-hero card">
                <div>
                  <span className="section-label">OVERALL SCORE</span>
                  <div className="comparison-scores">
                    <strong>{score(a.overall_score)}</strong>
                    <ArrowRight />
                    <strong>{score(b.overall_score)}</strong>
                  </div>
                </div>
                <div>
                  <span className="pill lavender">
                    {overall
                      ? `${overall.points > 0 ? "+" : ""}${overall.points} points`
                      : "Unavailable"}
                  </span>
                  <p>Numerical score change</p>
                </div>
              </div>
              <div className="notice">
                Lighting, pose, camera, and skin preparation can affect
                measurements. Score changes do not establish medical improvement
                or product causation.
                {a.provider_version !== b.provider_version
                  ? " These scans use different provider versions and cannot be compared."
                  : ""}
              </div>
              {!demo && (
                <div className="compare-selectors">
                  {[a, b].map((s) => (
                    <div className="card compare-photo" key={s.id}>
                      <span className="section-label">
                        {date(s.created_at)}
                      </span>
                      {photos[s.id] ? (
                        <img
                          src={photos[s.id]}
                          alt={"Retained scan from " + date(s.created_at)}
                        />
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => void photo(s.id)}
                        >
                          Show retained photograph
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <section className="card table-card">
                <div className="card-heading">
                  <h2>What changed?</h2>
                  <span className="muted">UI scores</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Measurement</th>
                        <th>Earlier</th>
                        <th>Later</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => (
                        <tr key={m.metric_type + m.region}>
                          <td>
                            {metricLabels[m.metric_type] || m.metric_type}
                            {m.region !== "whole" && (
                              <small> · {m.region}</small>
                            )}
                          </td>
                          <td>{score(m.before)}</td>
                          <td>{score(m.after)}</td>
                          <td>
                            {m.change ? (
                              <span className="pill neutral">
                                {m.change.points > 0 ? "+" : ""}
                                {m.change.points} pts
                              </span>
                            ) : (
                              "Unavailable"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <Button asChild variant="secondary">
                <Link
                  href={
                    "/insights?a=" +
                    encodeURIComponent(a.id) +
                    "&b=" +
                    encodeURIComponent(b.id)
                  }
                >
                  <Sparkles size={17} />
                  Explain this comparison
                </Link>
              </Button>
            </>
          ) : null}
        </>
      )}
    </>
  );
}
