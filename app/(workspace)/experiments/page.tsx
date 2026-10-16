"use client";
import Link from "next/link";
import { FlaskConical, Plus, ArrowUpRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, date } from "@/components/shared";
import { metricLabels } from "@/lib/types";
export default function Experiments() {
  const { data } = useApp();
  return (
    <>
      <PageHeader
        eyebrow="YOUR SKINCARE EXPERIMENT LAB"
        title="Less guessing. More observing."
        description="Keep a small record of your routine. See what changes alongside it."
        action={
          <Button asChild>
            <Link href="/experiments/new">
              <Plus size={17} />
              Create experiment
            </Link>
          </Button>
        }
      />
      <div className="notice">
        One change at a time helps you observe your routine. An association
        between product usage and a score change does not prove cause and
        effect.
      </div>
      {!data.experiments.length ? (
        <section className="card empty-state">
          <div className="empty-icon">
            <FlaskConical size={36} />
          </div>
          <h2>Give your routine a place to grow.</h2>
          <p>
            Choose a product, a baseline scan, and one measurement to observe.
          </p>
          <Button asChild>
            <Link href="/experiments/new">Create your first experiment</Link>
          </Button>
        </section>
      ) : (
        <div className="experiment-grid">
          {data.experiments.map((e) => (
            <Link
              key={e.id}
              href={"/experiments/" + e.id}
              className="card experiment-tile"
            >
              <div className="card-heading">
                <div className="stat-icon lavender">
                  <FlaskConical size={22} />
                </div>
                <span
                  className={
                    "pill " + (e.status === "active" ? "sage" : "neutral")
                  }
                >
                  {e.status}
                </span>
              </div>
              <h2>{e.title}</h2>
              <p>{e.product_name}</p>
              <dl>
                <div>
                  <dt>Observing</dt>
                  <dd>{metricLabels[e.target_metric] || e.target_metric}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{date(e.started_at)}</dd>
                </div>
                <div>
                  <dt>Routine</dt>
                  <dd>{e.frequency}</dd>
                </div>
              </dl>
              <div className="experiment-foot">
                <span>
                  {e.product_usage_logs?.length || 0} usage days recorded
                </span>
                <ArrowUpRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
