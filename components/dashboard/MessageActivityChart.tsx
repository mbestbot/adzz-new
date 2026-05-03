"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityPoint = { label: string; value: number };

type Props = {
  data: ActivityPoint[];
};

export default function MessageActivityChart({ data }: Props) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
        >
          <defs>
            <linearGradient id="msgActivityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
              <stop offset="55%" stopColor="#7c3aed" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 8"
            stroke="rgba(168, 85, 247, 0.12)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9d8db8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fill: "#9d8db8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
            domain={[0, "auto"]}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "rgba(192, 132, 252, 0.35)", strokeWidth: 1 }}
            contentStyle={{
              background: "#1e1530",
              border: "1px solid rgba(168, 85, 247, 0.35)",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#f4edff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            }}
            labelStyle={{ color: "#c084fc", marginBottom: 4 }}
            formatter={(value) => {
              const n =
                typeof value === "number"
                  ? value
                  : typeof value === "string"
                    ? Number(value)
                    : NaN;
              return Number.isFinite(n)
                ? [n.toLocaleString(), "Messages"]
                : ["—", ""];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#c084fc"
            strokeWidth={2.5}
            fill="url(#msgActivityFill)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#e879f9",
              stroke: "#faf5ff",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
