"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import styles from "./advertisingServers.module.css";

type PromoLinkItem = {
  id: string;
  url: string;
  code: string;
  guildName: string | null;
  approximateMemberCount: number | null;
  valid: boolean;
  expiresAt: number | null;
  addedAt: number;
  updatedAt: number;
};

export function PromoServersView() {
  const [items, setItems] = useState<PromoLinkItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  /** Row id -> draft replace URL */
  const [replaceDraft, setReplaceDraft] = useState<Record<string, string>>({});
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceBusy, setReplaceBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/promo-links");
      const data = (await res.json().catch(() => ({}))) as {
        items?: PromoLinkItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Load failed (${res.status})`);
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAdd = useCallback(async () => {
    const raw = addUrl.trim();
    if (!raw) return;
    setAddBusy(true);
    setAddErr(null);
    try {
      const res = await apiFetch("/api/promo-links", {
        method: "POST",
        body: JSON.stringify({ url: raw }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        item?: PromoLinkItem;
      };
      if (res.status === 409) {
        setAddErr(data.message ?? "That invite is already in your list.");
        return;
      }
      if (!res.ok) {
        throw new Error(
          data.message ?? data.error ?? `Add failed (${res.status})`
        );
      }
      setAddUrl("");
      await load();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddBusy(false);
    }
  }, [addUrl, load]);

  const submitReplace = useCallback(
    async (id: string) => {
      const raw = (replaceDraft[id] ?? "").trim();
      if (!raw) return;
      setReplaceBusy(id);
      setLoadErr(null);
      try {
        const res = await apiFetch(`/api/promo-links/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ url: raw }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (res.status === 409) {
          setLoadErr(data.message ?? "That invite is already used.");
          return;
        }
        if (!res.ok) {
          throw new Error(
            data.message ?? data.error ?? `Replace failed (${res.status})`
          );
        }
        setReplacingId(null);
        setReplaceDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
        await load();
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : "Replace failed");
      } finally {
        setReplaceBusy(null);
      }
    },
    [replaceDraft, load]
  );

  const removeLink = useCallback(
    async (id: string) => {
      try {
        const res = await apiFetch(`/api/promo-links/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`Remove failed (${res.status})`);
        }
        await load();
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : "Remove failed");
      }
    },
    [load]
  );

  function formatExpires(exp: number | null): string {
    if (exp == null) return "Never expires";
    const d = new Date(exp);
    if (Number.isNaN(d.getTime())) return "";
    return `Expires ${d.toLocaleString()}`;
  }

  return (
    <div className={styles.wrap}>
      <header style={{ marginBottom: "0.75rem" }}>
        <p
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--dash-accent-mid)",
            margin: "0 0 0.35rem",
          }}
        >
          Promo
        </p>
        <h1
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--dash-text)",
          }}
        >
          Invite links
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            color: "var(--dash-muted)",
            maxWidth: "36rem",
            lineHeight: 1.45,
          }}
        >
          Paste Discord invite URLs (<code className={styles.inlineCode}>discord.gg/…</code>).
          Duplicates are blocked. Invalid or expired invites show in red — use Replace to update.
        </p>
      </header>

      <div className={styles.toolbar}>
        <input
          type="url"
          className={styles.addInput}
          placeholder="https://discord.gg/your-invite"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitAdd();
          }}
          aria-label="Discord invite URL"
        />
        <button
          type="button"
          className={styles.addBtn}
          disabled={loading || addBusy || !addUrl.trim()}
          onClick={() => void submitAdd()}
        >
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          {addBusy ? "Adding…" : "Add link"}
        </button>
        <button
          type="button"
          className={styles.refreshBtn}
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {addErr ? (
        <p className={styles.bannerErr} role="alert">
          {addErr}
        </p>
      ) : null}

      {loadErr ? (
        <p className={styles.bannerErr} role="alert">
          {loadErr}
        </p>
      ) : null}

      {!loading && items.length === 0 && !loadErr ? (
        <p className={styles.empty}>
          No links yet — paste a discord.gg invite above.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.promoList}>
          {items.map((row) => {
            const expired = !row.valid;
            const repOpen = replacingId === row.id;
            return (
              <li
                key={row.id}
                className={`${styles.promoCard} ${expired ? styles.promoCardExpired : ""}`}
              >
                <div className={styles.promoCardMain}>
                  <div className={styles.promoCardText}>
                    <div className={styles.promoGuildRow}>
                      <Link2 size={14} strokeWidth={2} aria-hidden />
                      <span className={styles.promoGuildName}>
                        {row.guildName ?? "Discord server"}
                      </span>
                      {typeof row.approximateMemberCount === "number" ? (
                        <span className={styles.promoMembers}>
                          ~{row.approximateMemberCount.toLocaleString()} members
                        </span>
                      ) : null}
                    </div>
                    <a
                      className={styles.promoUrl}
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.url}
                      <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
                    </a>
                    <p className={styles.promoMeta}>
                      {formatExpires(row.expiresAt)}
                      {expired ? (
                        <span className={styles.promoExpiredBadge}> Invalid / expired</span>
                      ) : null}
                    </p>
                  </div>
                  <div className={styles.promoActions}>
                    <button
                      type="button"
                      className={styles.iconGhostBtn}
                      aria-label="Remove link"
                      onClick={() => void removeLink(row.id)}
                    >
                      <Trash2 size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </div>

                {repOpen ? (
                  <div className={styles.replaceRow}>
                    <input
                      type="url"
                      className={styles.replaceInput}
                      placeholder="New discord.gg or discord.com/invite/… URL"
                      value={replaceDraft[row.id] ?? ""}
                      onChange={(e) =>
                        setReplaceDraft((d) => ({
                          ...d,
                          [row.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void submitReplace(row.id);
                      }}
                      aria-label="Replacement invite URL"
                    />
                    <button
                      type="button"
                      className={styles.replaceSaveBtn}
                      disabled={
                        replaceBusy === row.id ||
                        !(replaceDraft[row.id] ?? "").trim()
                      }
                      onClick={() => void submitReplace(row.id)}
                    >
                      {replaceBusy === row.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className={styles.replaceCancelBtn}
                      disabled={replaceBusy === row.id}
                      onClick={() => {
                        setReplacingId(null);
                        setReplaceDraft((d) => {
                          const next = { ...d };
                          delete next[row.id];
                          return next;
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.replaceToggleBtn}
                    onClick={() => {
                      setReplacingId(row.id);
                      setReplaceDraft((d) => ({
                        ...d,
                        [row.id]: d[row.id] ?? "",
                      }));
                    }}
                  >
                    Replace link
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : null}
    </div>
  );
}
