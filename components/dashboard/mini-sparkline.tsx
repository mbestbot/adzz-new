"use client";

import { useId } from "react";

type Props = {
  values: number[];
  stroke: string;
  glow?: string;
};

export function MiniSparkline({
  values,
  stroke,
  glow = "rgba(168, 85, 247, 0.35)",
}: Props) {
  const gradientId = useId().replace(/:/g, "");
  if (!values.length) {
    return (
      <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
        <path
          d="M4 20 L68 20"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const w = 72;
  const h = 28;
  const pad = 3;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });

  const lineD = `M ${pts.join(" L ")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`${lineD} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
        fill={`url(#${gradientId})`}
      />
      <path
        d={lineD}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`drop-shadow(0 0 6px ${glow})`}
      />
    </svg>
  );
}
