"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./logs.module.css";

type AdLogRow = {
  id: string;
  at: number;
  level: string;
  message: string;
  botId: string | null;
  channelId: string | null;
  campaignId: string | null;
};

export function LogsView() {
  const [logs, setLogs] = useState<AdLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/ad-logs");
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Could not load logs (${res.status})`);
      setLogs([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { logs?: AdLogRow[] };
    setLogs(data.logs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        return;
      void load();
    }, 4000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Diagnostics
          </p>
          <h1 className={styles.title}>Delivery logs</h1>
          <p className={styles.lead}>
            Posting failures from the automated campaign worker (per channel).
            Successful sends are not listed here.
          </p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {error ? (
        <p className={styles.bannerErr} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : logs.length === 0 ? (
        <p className={styles.muted}>
          No errors recorded yet. If a channel shows{" "}
          <strong>Error</strong> on the Servers page, details will appear here
          after the next failed send.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Error log">
          {logs.map((row) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.rowMeta}>
                <time className={styles.time} dateTime={new Date(row.at).toISOString()}>
                  {new Date(row.at).toLocaleString()}
                </time>
                {row.channelId ? (
                  <span className={styles.pill}>Channel {row.channelId}</span>
                ) : null}
              </div>
              <p className={styles.message}>{row.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
