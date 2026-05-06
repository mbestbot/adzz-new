"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  adminGetJson,
  adminPostJson,
} from "@/lib/adminApi";
import type {
  AdminBotRow,
  AdminBotsListResponse,
  AdminBotsVerifyResponse,
  AdminBotVerifyOneResponse,
  AdminBotTokenStatus,
} from "./adminBotTypes";
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

function formatCheckedAt(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(s: AdminBotTokenStatus): string {
  switch (s) {
    case "ok":
      return "Valid";
    case "invalid":
      return "Invalid";
    case "error":
      return "Check failed";
    default:
      return "Not checked";
  }
}

export function BotsView() {
  const [rows, setRows] = useState<AdminBotRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoBotId, setInfoBotId] = useState<string | null>(null);
  const [verifyAllBusy, setVerifyAllBusy] = useState(false);
  const [rowCheckingId, setRowCheckingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    return adminGetJson<AdminBotsListResponse>("/api/admin/bots").then((d) => {
      setRows(d.bots);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((e: Error) => {
      if (!cancelled) setLoadError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const verifyAll = useCallback(() => {
    setVerifyAllBusy(true);
    setActionError(null);
    adminPostJson<AdminBotsVerifyResponse>("/api/admin/bots/verify-tokens", {})
      .then((d) => {
        setRows(d.bots);
      })
      .catch((e: Error) => setActionError(e.message))
      .finally(() => setVerifyAllBusy(false));
  }, []);

  const verifyOne = useCallback((botId: string) => {
    setRowCheckingId(botId);
    setActionError(null);
    adminPostJson<AdminBotVerifyOneResponse>(
      `/api/admin/bots/${encodeURIComponent(botId)}/verify-token`,
      {}
    )
      .then((d) => {
        const row = d.bot;
        if (!row) return;
        setRows((prev) =>
          prev ? prev.map((r) => (r.id === row.id ? row : r)) : [row]
        );
      })
      .catch((e: Error) => setActionError(e.message))
      .finally(() => setRowCheckingId(null));
  }, []);

  if (loadError) {
    return <div className={styles.error}>{loadError}</div>;
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
      {actionError ? (
        <div className={styles.errorBanner} role="alert">
          {actionError}
        </div>
      ) : null}
      <div className={styles.toolbar}>
        <p className={styles.toolbarHint}>
          Token status updates automatically about every hour (Discord{" "}
          <span className={styles.monoInline}>/users/@me</span>). Use Check all or the
          row button for an immediate check.
        </p>
        <button
          type="button"
          className={styles.verifyAllBtn}
          disabled={verifyAllBusy || rows.length === 0}
          onClick={() => void verifyAll()}
        >
          {verifyAllBusy ? (
            "Checking all…"
          ) : (
            <>
              <RefreshCw size={16} strokeWidth={2.25} aria-hidden />
              Check all tokens
            </>
          )}
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Bot</th>
              <th className={styles.th}>Owner</th>
              <th className={styles.th}>Egress (proxy host)</th>
              <th className={styles.th}>Ads posted</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Created</th>
              <th className={styles.th} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={8}>
                  No bots in store.
                </td>
              </tr>
            ) : (
              rows.map((b) => {
                const checking = rowCheckingId === b.id;
                const badgeClass =
                  b.tokenStatus === "ok"
                    ? styles.statusOk
                    : b.tokenStatus === "invalid"
                      ? styles.statusBad
                      : b.tokenStatus === "error"
                        ? styles.statusWarn
                        : styles.statusMuted;
                const titleParts = [
                  statusLabel(b.tokenStatus),
                  b.tokenCheckedAt != null
                    ? `Last check: ${formatDate(b.tokenCheckedAt)}`
                    : null,
                  b.tokenCheckHttp != null ? `HTTP ${b.tokenCheckHttp}` : null,
                  b.tokenCheckError ?? null,
                ].filter(Boolean);
                return (
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
                    <td className={styles.td}>
                      <span
                        className={`${styles.statusBadge} ${badgeClass}`}
                        title={titleParts.join(" · ")}
                      >
                        {statusLabel(b.tokenStatus)}
                      </span>
                      {b.tokenCheckedAt != null ? (
                        <div className={styles.statusSub}>
                          {formatCheckedAt(b.tokenCheckedAt)}
                        </div>
                      ) : null}
                    </td>
                    <td className={styles.td}>{b.tokenType}</td>
                    <td className={styles.td}>{formatDate(b.createdAt)}</td>
                    <td className={styles.td}>
                      <div className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.checkBtn}
                          title="Check this bot’s token now"
                          aria-label={`Check token for ${b.displayName || b.username || b.id}`}
                          disabled={checking || verifyAllBusy}
                          onClick={() => void verifyOne(b.id)}
                        >
                          <RefreshCw
                            size={15}
                            strokeWidth={2.25}
                            className={checking ? styles.iconSpin : undefined}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className={styles.infoBtn}
                          title="Credentials, token, extraction script"
                          aria-label="Bot details and credentials"
                          onClick={() => setInfoBotId(b.id)}
                        >
                          i
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
