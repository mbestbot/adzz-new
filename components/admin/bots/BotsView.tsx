"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGetJson } from "@/lib/adminApi";
import type { AdminBotRow, AdminBotsListResponse } from "./adminBotTypes";
import { BotInfoModal } from "./BotInfoModal";
import styles from "./bots.module.css";

function egressLabel(row: AdminBotRow) {
  if (row.egressMode === "direct" || !row.egressHostPort) {
    return "Server IP (no proxy)";
  }
  return row.egressHostPort;
}

function formatDate(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export function BotsView() {
  const [rows, setRows] = useState<AdminBotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoBotId, setInfoBotId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return adminGetJson<AdminBotsListResponse>("/api/admin/bots").then((d) => {
      setRows(d.bots);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!rows) {
    return <p className={styles.muted}>Loading bots…</p>;
  }

  return (
    <>
      <BotInfoModal
        botId={infoBotId}
        open={infoBotId != null}
        onClose={() => setInfoBotId(null)}
        onSaved={() => void load()}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Bot</th>
              <th className={styles.th}>Owner</th>
              <th className={styles.th}>Egress (proxy host)</th>
              <th className={styles.th}>Ads posted</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Created</th>
              <th className={styles.th} aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={7}>
                  No bots in store.
                </td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id}>
                  <td className={styles.td}>
                    <strong style={{ color: "var(--dash-text)" }}>
                      {b.displayName || b.username || "—"}
                    </strong>
                    <div className={`${styles.mono}`}>@{b.username || "—"}</div>
                    <div className={`${styles.mono}`}>{b.id}</div>
                  </td>
                  <td className={styles.td}>
                    {b.ownerEmail || "—"}
                    <div className={`${styles.mono}`}>{b.userId}</div>
                  </td>
                  <td className={`${styles.td} ${styles.mono}`}>
                    {egressLabel(b)}
                    {b.egressSlotIndex != null && b.egressMode === "proxy" ? (
                      <div className={styles.muted} style={{ marginTop: "0.2rem" }}>
                        slot {b.egressSlotIndex}
                      </div>
                    ) : null}
                  </td>
                  <td className={styles.td}>{b.adsPostedTotal.toLocaleString()}</td>
                  <td className={styles.td}>{b.tokenType}</td>
                  <td className={styles.td}>{formatDate(b.createdAt)}</td>
                  <td className={styles.td}>
                    <button
                      type="button"
                      className={styles.infoBtn}
                      title="Credentials, token, extraction script"
                      aria-label="Bot details and credentials"
                      onClick={() => setInfoBotId(b.id)}
                    >
                      i
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
