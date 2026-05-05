"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { API_BASE } from "@/lib/api";
import styles from "./landing.module.css";

type PlatformStats = {
  adsPostedToday: number;
  adsPostedTotal: number;
  updatedAt: number;
};

const POLL_MS = 5000;

export function LandingLiveStatsSection() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const res = await fetch(`${API_BASE}/api/public/platform-stats`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as PlatformStats;
        if (!cancelled) {
          setStats(data);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    void pull();
    const id = window.setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const today =
    stats != null && Number.isFinite(stats.adsPostedToday)
      ? stats.adsPostedToday
      : null;
  const total =
    stats != null && Number.isFinite(stats.adsPostedTotal)
      ? stats.adsPostedTotal
      : null;

  return (
    <section
      id="live-network-stats"
      className={styles.liveStatsSection}
      aria-labelledby="live-stats-heading"
    >
      <div className={styles.liveStatsGlow} aria-hidden />
      <div className={styles.liveStatsInner}>
        <div className={styles.liveStatsIntro}>
          <p className={styles.liveStatsEyebrow}>
            <Activity size={14} strokeWidth={2.25} aria-hidden />
            Live network
          </p>
          <h2 id="live-stats-heading" className={styles.liveStatsTitle}>
            Ads flowing across Adzz right now
          </h2>
          <p className={styles.liveStatsLead}>
            Platform-wide counters pulled from real delivery volume. Numbers
            refresh every few seconds so visitors see live throughput and
            all-time scale.
          </p>
        </div>

        <div className={styles.liveStatsGrid}>
          <article className={styles.liveStatsCard}>
            <div className={styles.liveStatsCardTop}>
              <span className={styles.liveStatsLabel}>Sending today (UTC)</span>
              <span className={styles.liveStatsBadge}>
                <span className={styles.liveStatsPulse} aria-hidden />
                Live
              </span>
            </div>
            <p
              className={styles.liveStatsFigure}
              aria-live="polite"
              aria-atomic="true"
            >
              {today != null
                ? today.toLocaleString()
                : loadError
                  ? "—"
                  : "…"}
            </p>
            <p className={styles.liveStatsHint}>
              Successful posts counted for the current UTC calendar day.
            </p>
          </article>

          <article
            className={`${styles.liveStatsCard} ${styles.liveStatsCardTotal}`}
          >
            <div className={styles.liveStatsCardTop}>
              <span className={styles.liveStatsLabel}>Total ads posted</span>
              <span className={styles.liveStatsBadgeMuted}>All time</span>
            </div>
            <p
              className={styles.liveStatsFigure}
              aria-live="polite"
              aria-atomic="true"
            >
              {total != null
                ? total.toLocaleString()
                : loadError
                  ? "—"
                  : "…"}
            </p>
            <p className={styles.liveStatsHint}>
              Cumulative sends recorded across every connected workspace.
            </p>
          </article>
        </div>

        <p className={styles.liveStatsFoot}>
          {loadError && stats == null
            ? "Could not load live stats — check that the API is reachable."
            : `Updates every ${POLL_MS / 1000}s · Same totals power your dashboard analytics.`}
        </p>
      </div>
    </section>
  );
}
