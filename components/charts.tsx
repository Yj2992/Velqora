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
              <stop offset="0%" stopColor="#70556A" stopOpacity={0.19} />
              <stop offset="95%" stopColor="#70556A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#EAE5E8"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#817B82", fontSize: 11 }}
            dy={12}
          />
          <YAxis
            domain={["auto", "auto"]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#817B82", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #EAE5E8",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="#70556A"
            strokeWidth={2.5}
            fill="url(#scoreGradient)"
            dot={{ r: 4, fill: "#FAF8F5", strokeWidth: 2 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
