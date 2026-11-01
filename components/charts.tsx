"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { series } from "@/lib/progress";
import type { Scan } from "@/lib/types";
export function TrendChart({
  scans,
  metric = "all",
}: {
  scans: Scan[];
  metric?: string;
}) {
  const points = series(scans, metric).map((s) => ({
    ...s,
    label: new Date(s.date).toLocaleDateString("en", {
      day: "numeric",
      month: "short",
    }),
  }));
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <span className="baseline-dot" />
        <strong>
          {points.length ? "Your baseline is set" : "Your story starts here"}
        </strong>
        <p>
          {points.length
            ? "A second scan will reveal your first comparison."
            : "Complete a scan to begin tracking."}
        </p>
      </div>
    );
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${metric} score history across ${points.length} scans`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 18, right: 12, left: -28, bottom: 0 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.38} />
              <stop offset="65%" stopColor="#8b5cf6" stopOpacity={0.14} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="scoreStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="55%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(148, 163, 184, 0.16)"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            dy={12}
          />
          <YAxis
            domain={["auto", "auto"]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(6, 182, 212, 0.42)",
              color: "#f8fafc",
              boxShadow: "0 12px 28px rgba(2, 6, 23, 0.75)",
              fontSize: 12,
            }}
            itemStyle={{ color: "#67e8f9" }}
            labelStyle={{ color: "#cbd5e1", marginBottom: 4 }}
          />
          <Area
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="url(#scoreStroke)"
            strokeWidth={2.8}
            fill="url(#scoreGradient)"
            dot={{ r: 4, fill: "#06b6d4", stroke: "#0f172a", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#22d3ee", stroke: "#f8fafc", strokeWidth: 2 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
