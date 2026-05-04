"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
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

export function PotentialClientsView() {
  const [rows, setRows] = useState<PotentialClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    load().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

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

  if (error) {
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
    <div className={styles.grid}>
      {rows.map((r) => {
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
  );
}
