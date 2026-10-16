"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ScanFace,
  Sparkles,
  Droplets,
  FlaskConical,
  ArrowRight,
  Sun,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty, date, score } from "@/components/shared";
import { TrendChart } from "@/components/charts";
import { metricValue, delta, deterministicSummary } from "@/lib/progress";
export default function Dashboard() {
  const { data, demo } = useApp(),
    scans = data.scans
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    latest = scans.at(-1),
    previous =
      scans.at(-2)?.provider_version === latest?.provider_version
        ? scans.at(-2)
        : undefined,
    experiment =
      data.experiments.find((e) => e.status === "active") ||
      data.experiments[0];
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE CLARITY, EVERY DAY"
        title={`Your skin, in perspective${data.profile.display_name ? ", " + data.profile.display_name : ""}.`}
        description="Take a breath. Get to know your skin, one scan at a time."
        action={
          <Button asChild>
            <Link href="/scan">
              <ScanFace size={18} />
              New skin scan <ArrowUpRight size={16} />
            </Link>
          </Button>
        }
      />
      {!latest ? (
        <Empty />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="overview-grid">
            <section className="card score-card">
              <div className="card-top">
                <span className="section-label">YOUR SKIN SCORE</span>
                <span className="pill neutral">Latest scan</span>
              </div>
              <div className="score-main">
                <div className="score-ring">
                  <svg viewBox="0 0 150 150">
                    <circle
                      cx="75"
                      cy="75"
                      r="62"
                      fill="none"
                      stroke="#EAE5E8"
                      strokeWidth="7"
                    />
                    <circle
                      cx="75"
                      cy="75"
                      r="62"
                      fill="none"
                      stroke="#70556A"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(100, Math.max(0, latest.overall_score || 0)) * 3.896} 389.6`}
                      transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <div>
                    <strong>{score(latest.overall_score)}</strong>
                    <small>/ 100</small>
                  </div>
                </div>
                <div className="score-copy">
                  <span className="pill sage">
                    {previous &&
                    delta(previous.overall_score, latest.overall_score)
                      ? `${delta(previous.overall_score, latest.overall_score)!.points > 0 ? "+" : ""}${delta(previous.overall_score, latest.overall_score)!.points} points`
                      : "Baseline recorded"}
                  </span>
                  <p>
                    {previous
                      ? "Since your previous scan"
                      : "The beginning of your story"}
                  </p>
                  <Link href={"/scan/" + latest.id}>
                    Explore your analysis <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="card-bottom">
                <CalendarDays size={14} />
                {date(latest.created_at)}
                <span>{demo ? "Synthetic measurement" : "YouCam Skin AI"}</span>
              </div>
            </section>
            <section className="card stat-card">
              <div className="stat-icon lavender">
                <Sun size={21} />
              </div>
              <span className="section-label">SKIN AGE</span>
              <div className="stat-number">
                {score(latest.skin_age)}
                <small>years</small>
              </div>
              <p>
                A cosmetic appearance estimate.
                <br />
                Not your biological age.
              </p>
            </section>
            <section className="card stat-card">
              <div className="stat-icon sage-bg">
                <Droplets size={21} />
              </div>
              <span className="section-label">SKIN TYPE</span>
              <div className="stat-word">
                {latest.skin_type_results.find((t) => t.region === "whole")
                  ?.skin_type || "Unavailable"}
              </div>
              <p>
                {latest.skin_type_results.length
                  ? "Based on your latest analysis."
                  : "No classification returned."}
                <br />
                Your skin can change with time.
              </p>
            </section>
          </div>
          <div className="dashboard-middle">
            <section className="card progress-card">
              <div className="card-heading">
                <div>
                  <span className="section-label">THE BIGGER PICTURE</span>
                  <h2>Your skin over time</h2>
                </div>
                <Link className="text-link" href="/progress">
                  View progress <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="chart-meta">
                <span>
                  <i className="chart-key" />
                  Overall skin score
                </span>
                <span>{scans.length} scans recorded</span>
              </div>
              <TrendChart scans={scans} />
              <p className="chart-caption">
                Small observations. A clearer picture over time.
              </p>
            </section>
            <section className="card indicators">
              <div className="card-heading">
                <div>
                  <span className="section-label">A CLOSER LOOK</span>
                  <h2>Skin indicators</h2>
                </div>
                <span className="mini-icon">
                  <ScanFace size={20} />
                </span>
              </div>
              {["texture", "moisture", "pore", "radiance", "acne"].map(
                (m, i) => {
                  const value = metricValue(latest, m);
                  return (
                    <div className="indicator" key={m}>
                      <div>
                        <span>
                          {
                            [
                              "Texture",
                              "Moisture",
                              "Pores",
                              "Radiance",
                              "Acne",
                            ][i]
                          }
                        </span>
                        <strong>{score(value)}</strong>
                      </div>
                      <div className="indicator-track">
                        <i
                          style={{
                            width: Math.min(100, Math.max(0, value || 0)) + "%",
                            background: [
                              "#70556A",
                              "#A9BEAD",
                              "#B4A2BE",
                              "#C7B291",
                              "#90798A",
                            ][i],
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
              <Link
                href={"/scan/" + latest.id}
                className="text-link all-indicators"
              >
                All 15 indicators <ArrowRight size={15} />
              </Link>
            </section>
          </div>
          <div className="dashboard-bottom">
            <section className="insight-card">
              <div className="insight-orb">
                <Sparkles size={26} />
              </div>
              <div>
                <span className="section-label">YOUR LATEST OBSERVATION</span>
                <h2>A routine worth understanding.</h2>
                <p>
                  {data.insights.at(-1)?.response ||
                    deterministicSummary(scans)}
                </p>
                <Link href="/insights" className="text-link">
                  Explore your insights <ArrowUpRight size={16} />
                </Link>
                <small>
                  {data.insights.at(-1)?.source === "llm"
                    ? "AI explanation"
                    : "Deterministic summary"}
                </small>
              </div>
            </section>
            <section className="card experiment-preview">
              <div className="card-heading">
                <span className="section-label">YOUR EXPERIMENT LAB</span>
                <FlaskConical size={20} />
              </div>
              {experiment ? (
                <>
                  <span className="pill sage">{experiment.status}</span>
                  <h2>{experiment.title}</h2>
                  <p>{experiment.product_name}</p>
                  <div className="experiment-foot">
                    <span>
                      {experiment.product_usage_logs?.length || 0} usage days
                      logged
                    </span>
                    <Link
                      aria-label="View experiment"
                      href={"/experiments/" + experiment.id}
                    >
                      <ArrowUpRight size={21} />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>Let your routine tell its story.</h2>
                  <p>Track one product and observe what changes.</p>
                  <Link className="text-link" href="/experiments/new">
                    Create an experiment <ArrowUpRight size={16} />
                  </Link>
                </>
              )}
            </section>
          </div>
        </motion.div>
      )}
    </>
  );
}
