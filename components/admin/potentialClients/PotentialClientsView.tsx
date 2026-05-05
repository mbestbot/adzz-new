"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { adminGetJson, adminPostJson } from "@/lib/adminApi";
import botStyles from "../bots/bots.module.css";
import styles from "./potentialClients.module.css";

export type PotentialClientChannel = { id: string; name: string };

export type PotentialClientRow = {
  discordGuildId: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  channelCount: number;
  channelsPreview: PotentialClientChannel[];
  channelsTruncated: boolean;
  openInDiscordUrl: string | null;
  botLabels: string[];
  ownerEmails: string[];
  updatedAt: number;
  contacted: boolean;
  contactedAt: number | null;
};

type PotentialClientsResponse = { clients: PotentialClientRow[] };

type ContactMutationResponse = PotentialClientsResponse & {
  ok: boolean;
  discordGuildId: string;
  contacted: boolean;
};

const POLL_MS = 60_000;

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}

function guildInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const c = t[0];
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

function rowMatchesQuery(r: PotentialClientRow, q: string): boolean {
  if (!q) return true;
  const n = r.name.toLowerCase();
  const id = r.discordGuildId.toLowerCase();
  if (n.includes(q) || id.includes(q)) return true;
  if (r.botLabels.some((b) => b.toLowerCase().includes(q))) return true;
  if (r.ownerEmails.some((e) => e.toLowerCase().includes(q))) return true;
  return false;
}

export function PotentialClientsView() {
  const [rows, setRows] = useState<PotentialClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return adminGetJson<PotentialClientsResponse>(
      "/api/admin/potential-clients"
    ).then((d) => {
      setRows(d.clients);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    load()
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void load().catch((e: Error) => setError(e.message));
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load().catch((e: Error) => setError(e.message));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((r) => rowMatchesQuery(r, q));
  }, [rows, query]);

  const setApproached = useCallback(
    async (guildId: string, contacted: boolean) => {
      setBusyId(guildId);
      setError(null);
      try {
        const path = `/api/admin/potential-clients/${encodeURIComponent(guildId)}/contacted`;
        const d = await adminPostJson<ContactMutationResponse>(path, {
          contacted,
        });
        setRows(d.clients);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const onManualRefresh = () => {
    setRefreshing(true);
    void load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  };

  if (error && !rows) {
    return <div className={botStyles.error}>{error}</div>;
  }

  if (!rows) {
    return <p className={botStyles.muted}>Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className={styles.empty}>
        No servers in cache yet. After bots sync guilds, cards show up here
        (one card per Discord server).
      </p>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} strokeWidth={2} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search name, guild id, bot label, owner email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter potential clients"
          />
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          disabled={refreshing}
          onClick={onManualRefresh}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className={botStyles.error} style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className={styles.empty}>No servers match your search.</p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((r) => {
            const iconSrc = guildIconUrl(r.discordGuildId, r.icon);
            const busy = busyId === r.discordGuildId;
            return (
              <article
                key={r.discordGuildId}
                className={`${styles.card} ${r.contacted ? styles.cardApproached : ""}`}
              >
                <div className={styles.iconWrap}>
                  {iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.icon}
                      src={iconSrc}
                      alt=""
                      width={52}
                      height={52}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className={styles.iconFallback} aria-hidden>
                      {guildInitial(r.name)}
                    </div>
                  )}
                </div>
                <h3 className={styles.serverName}>{r.name}</h3>
                <p className={styles.members}>
                  {r.approximateMemberCount.toLocaleString()} members
                </p>
                {r.openInDiscordUrl ? (
                  <a
                    className={styles.joinLink}
                    href={r.openInDiscordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join
                    <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
                  </a>
                ) : (
                  <span className={styles.joinMuted}>No link</span>
                )}
                {r.contacted ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={busy}
                    onClick={() => void setApproached(r.discordGuildId, false)}
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                    disabled={busy}
                    onClick={() => void setApproached(r.discordGuildId, true)}
                  >
                    Mark approached
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
