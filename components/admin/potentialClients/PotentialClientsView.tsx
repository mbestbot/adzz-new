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

function formatDate(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
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

  const setContacted = useCallback(
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
    return <p className={botStyles.muted}>Loading potential clients…</p>;
  }

  return (
    <div className={botStyles.tableWrap}>
      <table className={botStyles.table}>
        <thead>
          <tr>
            <th className={botStyles.th}>Server</th>
            <th className={botStyles.th}>Members</th>
            <th className={botStyles.th}>Open in Discord</th>
            <th className={botStyles.th}>Channels</th>
            <th className={botStyles.th}>Bots</th>
            <th className={botStyles.th}>Owner emails</th>
            <th className={botStyles.th}>Outreach</th>
            <th className={botStyles.th} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={botStyles.td} colSpan={8}>
                No guilds in cache yet. When user bots finish syncing servers,
                deduplicated rows appear here.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.discordGuildId}>
                <td className={botStyles.td}>
                  <strong style={{ color: "var(--dash-text)" }}>{r.name}</strong>
                  <div className={botStyles.mono}>{r.discordGuildId}</div>
                  <div className={botStyles.muted} style={{ marginTop: "0.2rem" }}>
                    Cache updated {formatDate(r.updatedAt)}
                  </div>
                </td>
                <td className={botStyles.td}>
                  {r.approximateMemberCount.toLocaleString()}
                </td>
                <td className={botStyles.td}>
                  {r.openInDiscordUrl ? (
                    <a
                      className={styles.linkBtn}
                      href={r.openInDiscordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                      <ExternalLink size={14} strokeWidth={2} aria-hidden />
                    </a>
                  ) : (
                    <span className={botStyles.muted}>No text channels</span>
                  )}
                </td>
                <td className={botStyles.td}>
                  <div className={botStyles.muted} style={{ marginBottom: "0.25rem" }}>
                    {r.channelCount} total
                  </div>
                  {r.channelsPreview.length ? (
                    <ul className={styles.channelList}>
                      {r.channelsPreview.map((c) => (
                        <li key={c.id}>
                          #{c.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className={botStyles.muted}>—</span>
                  )}
                  {r.channelsTruncated ? (
                    <div className={botStyles.muted} style={{ marginTop: "0.2rem" }}>
                      …more not shown
                    </div>
                  ) : null}
                </td>
                <td className={botStyles.td}>
                  {r.botLabels.length ? r.botLabels.join(", ") : "—"}
                </td>
                <td className={`${botStyles.td} ${botStyles.mono}`}>
                  {r.ownerEmails.length ? r.ownerEmails.join(", ") : "—"}
                </td>
                <td className={botStyles.td}>
                  {r.contacted ? (
                    <span>
                      <span className={styles.badge}>Contacted</span>
                      <div className={botStyles.muted} style={{ marginTop: "0.25rem" }}>
                        {formatDate(r.contactedAt)}
                      </div>
                    </span>
                  ) : (
                    <span className={botStyles.muted}>Not yet</span>
                  )}
                </td>
                <td className={botStyles.td}>
                  {r.contacted ? (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      disabled={busyId === r.discordGuildId}
                      onClick={() => void setContacted(r.discordGuildId, false)}
                    >
                      Undo
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDone}`}
                      disabled={busyId === r.discordGuildId}
                      onClick={() => void setContacted(r.discordGuildId, true)}
                    >
                      Mark contacted
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
