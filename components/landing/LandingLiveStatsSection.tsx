"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import styles from "./landing.module.css";

type PlatformStats = {
  adsPostedTotal: number;
};

/** Fast polling so the total feels live; pauses when the tab is hidden. */
const POLL_MS = 2000;

export function LandingLiveStatsSection() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function pull() {
      try {
        const res = await fetch(`${API_BASE}/api/public/platform-stats`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as Record<string, unknown>;
        const total = Number(data.adsPostedTotal);
        if (!cancelled) {
          setStats({
            adsPostedTotal: Number.isFinite(total) ? total : 0,
          });
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    function stopPolling() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }

    function startPolling() {
      stopPolling();
      intervalId = setInterval(() => {
        void pull();
      }, POLL_MS);
    }

    function syncPolling() {
      if (typeof document !== "undefined" && document.hidden) {
        stopPolling();
        return;
      }
      void pull();
      startPolling();
    }

    syncPolling();
    document.addEventListener("visibilitychange", syncPolling);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", syncPolling);
    };
  }, []);

  const total =
    stats != null && Number.isFinite(stats.adsPostedTotal)
      ? stats.adsPostedTotal
      : null;

  return (
    <section
      id="live-network-stats"
      className={styles.liveStatsSection}
      aria-labelledby="live-stats-label"
    >
      <div className={styles.liveStatsInner}>
        <div className={styles.liveStatsMeta}>
          <span id="live-stats-label" className={styles.liveStatsLabelPlain}>
            Total ads posted
          </span>
          <span className={styles.liveStatsBadge}>
            <span className={styles.liveStatsPulse} aria-hidden />
            Live
          </span>
        </div>

        <p
          className={styles.liveStatsMega}
          aria-live="polite"
          aria-atomic="true"
        >
          {total != null
            ? total.toLocaleString()
            : loadError
              ? "—"
              : "…"}
        </p>

        <p className={styles.liveStatsFoot}>
          {loadError && stats == null
            ? "Could not load live stats — check that the API is reachable."
            : `Updating live every ${POLL_MS / 1000}s`}
        </p>
      </div>
    </section>
  );
}
