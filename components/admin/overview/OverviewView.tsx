"use client";

import { useEffect, useState } from "react";
import { adminGetJson } from "@/lib/adminApi";
import type { AdminOverview } from "./overviewTypes";
import styles from "./overview.module.css";

function StatCard({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className={`${styles.card} ${muted ? styles.cardMuted : ""}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {sub ? <p className={styles.sub}>{sub}</p> : null}
    </div>
  );
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function OverviewView() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminGetJson<AdminOverview>("/api/admin/overview")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!data) {
    return <p className={styles.sub}>Loading overview…</p>;
  }

  const { pricing } = data;

  return (
    <>
      <h2 className={styles.sectionTitle}>Users &amp; subscriptions</h2>
      <div className={styles.grid}>
        <StatCard label="Total users" value={String(data.totalUsers)} />
        <StatCard
          label="Subscribed (active)"
          value={String(data.subscribedUsers)}
        />
        <StatCard label="Pro (active)" value={String(data.proPlanActive)} />
        <StatCard
          label="Business (active)"
          value={String(data.businessPlanActive)}
        />
        <StatCard label="MRR" value={formatUsd(data.mrrUsd)} />
        <StatCard label="ARR" value={formatUsd(data.arrUsd)} />
      </div>
      <p className={styles.sub} style={{ marginTop: "0.75rem" }}>
        MRR/ARR assume launch prices: Pro {formatUsd(pricing.proUsd)}/mo,
        Business {formatUsd(pricing.businessUsd)}/mo × active seats.
      </p>

      <h2 className={styles.sectionTitle}>Ads posted (all accounts)</h2>
      <div className={styles.grid}>
        <StatCard label="Today (UTC)" value={String(data.adsPostedToday)} muted />
        <StatCard
          label="Last 7 days (UTC)"
          value={String(data.adsPostedThisWeek)}
          muted
        />
        <StatCard
          label="This calendar month (UTC)"
          value={String(data.adsPostedThisMonth)}
          muted
        />
        <StatCard
          label="Total (daily buckets)"
          value={String(data.adsPostedTotal)}
          sub="Sum of per-user daily send counts in the store."
          muted
        />
      </div>
    </>
  );
}
