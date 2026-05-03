"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminGetJson } from "@/lib/adminApi";
import type { AdminOverview } from "./overviewTypes";
import styles from "./overview.module.css";

const LS_EXCLUDE = "adzz_admin_revenue_exclude_user_ids";

function readExcludeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_EXCLUDE);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return [...new Set(p.map((x) => String(x).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function writeExcludeIds(ids: string[]) {
  const uniq = [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
  localStorage.setItem(LS_EXCLUDE, JSON.stringify(uniq));
}

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

function overviewPath(excludeIds: string[]) {
  if (!excludeIds.length) return "/api/admin/overview";
  const q = encodeURIComponent(excludeIds.join(","));
  return `/api/admin/overview?excludeFromMrr=${q}`;
}

export function OverviewView() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [idsDraft, setIdsDraft] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const ids = readExcludeIds();
      const d = await adminGetJson<AdminOverview>(overviewPath(ids));
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load overview");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = useCallback(() => {
    setIdsDraft(readExcludeIds().join("\n"));
    setModalOpen(true);
  }, []);

  const applyExclusions = useCallback(() => {
    const ids = idsDraft
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    writeExcludeIds(ids);
    setModalOpen(false);
    void load();
  }, [idsDraft, load]);

  const clearExclusions = useCallback(() => {
    localStorage.removeItem(LS_EXCLUDE);
    setModalOpen(false);
    void load();
  }, [load]);

  const revenueFootnote = useMemo(() => {
    if (!data || data.revenueExclusionCount === 0) return null;
    return `Excluding ${data.revenueExclusionCount} user id(s) from subscription revenue below. Unfiltered MRR ${formatUsd(data.mrrUsdAll)} · ARR ${formatUsd(data.arrUsdAll)}.`;
  }, [data]);

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!data) {
    return <p className={styles.sub}>Loading overview…</p>;
  }

  const { pricing } = data;
  const exclusionActive = data.revenueExclusionCount > 0;

  return (
    <>
      <h2 className={styles.sectionTitle}>Users &amp; subscriptions</h2>
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolBtn} onClick={openModal}>
          Set revenue exclusions…
        </button>
        {exclusionActive ? (
          <button type="button" className={styles.toolBtnGhost} onClick={clearExclusions}>
            Clear exclusions
          </button>
        ) : null}
      </div>
      {revenueFootnote ? <p className={styles.hint}>{revenueFootnote}</p> : null}

      <div className={styles.grid}>
        <StatCard label="Total users" value={String(data.totalUsers)} />
        <StatCard
          label="Subscribed (active)"
          value={String(data.subscribedUsers)}
          sub={
            exclusionActive
              ? `All accounts: ${data.subscribedUsersAll}`
              : undefined
          }
        />
        <StatCard
          label="Pro (active)"
          value={String(data.proPlanActive)}
          sub={exclusionActive ? `All: ${data.proPlanActiveAll}` : undefined}
        />
        <StatCard
          label="Business (active)"
          value={String(data.businessPlanActive)}
          sub={
            exclusionActive ? `All: ${data.businessPlanActiveAll}` : undefined
          }
        />
        <StatCard label="MRR" value={formatUsd(data.mrrUsd)} />
        <StatCard label="ARR" value={formatUsd(data.arrUsd)} />
      </div>
      <p className={styles.sub} style={{ marginTop: "0.75rem" }}>
        MRR/ARR use launch prices: Pro {formatUsd(pricing.proUsd)}/mo, Business{" "}
        {formatUsd(pricing.businessUsd)}/mo × active seats (after exclusions when
        set).
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

      {modalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className={styles.modal} role="dialog" aria-labelledby="excl-title">
            <h3 id="excl-title" className={styles.modalTitle}>
              Exclude from revenue stats
            </h3>
            <p className={styles.modalLead}>
              Paste internal <strong>user ids</strong> (from the Users table) for
              owners, comped accounts, etc. One per line or comma-separated. Saved
              only in this browser.
            </p>
            <textarea
              className={styles.modalTextarea}
              rows={8}
              value={idsDraft}
              onChange={(e) => setIdsDraft(e.target.value)}
              placeholder="e.g. uuid-here"
              spellCheck={false}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.toolBtn} onClick={applyExclusions}>
                Save &amp; reload
              </button>
              <button
                type="button"
                className={styles.toolBtnGhost}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
