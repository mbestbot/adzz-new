"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityPoint = {
  /** Shown on X-axis (may be "" to skip tick for sparse months). */
  label: string;
  value: number;
};

export type ActivityRange = "today" | "week" | "month" | "year";

type Props = {
  data: ActivityPoint[];
  range: ActivityRange;
};

export function PerformanceOverviewChart({ data, range }: Props) {
  const uid = useId().replace(/:/g, "");
  const fillId = `msgActFill-${uid}`;

  const xInterval =
    range === "today" ? 0 : range === "month" ? 2 : range === "year" ? 0 : 0;

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.42} />
              <stop offset="45%" stopColor="#0ea5e9" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148, 163, 184, 0.14)"
            vertical={range === "today" || range === "month"}
            horizontal
          />
          <XAxis
            dataKey="label"
            tick={{
              fill: "#94a3b8",
              fontSize: range === "today" ? 9 : 10,
            }}
            tickLine={false}
            axisLine={false}
            dy={10}
            interval={xInterval}
            minTickGap={range === "today" ? 6 : 8}
            tickFormatter={(v) => (v == null || v === "" ? "" : String(v))}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              Number.isFinite(v) ? Number(v).toLocaleString("en-US") : ""
            }
            domain={[0, "auto"]}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "rgba(56, 189, 248, 0.35)", strokeWidth: 1 }}
            contentStyle={{
              background: "#0c1118",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#e2e8f0",
              boxShadow: "0 10px 36px rgba(0,0,0,0.55)",
            }}
            labelStyle={{ color: "#38bdf8", marginBottom: 4 }}
            formatter={(value) => {
              const n =
                typeof value === "number"
                  ? value
                  : typeof value === "string"
                    ? Number(value)
                    : NaN;
              return Number.isFinite(n)
                ? [n.toLocaleString("en-US"), "Messages"]
                : ["—", ""];
            }}
          />
          <Area
            type="basis"
            dataKey="value"
            name="Messages"
            stroke="#38bdf8"
            strokeWidth={2.25}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{
              r: 5,
              fill: "#7dd3fc",
              stroke: "#0f172a",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
