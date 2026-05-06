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
  inviteCode?: string;
  discordGuildId?: string | null;
  guildIcon?: string | null;
  guildName: string | null;
  approximateMemberCount: number | null;
  valid: boolean;
  expiresAt: number | null;
  addedAt: number;
  updatedAt: number;
  lastValidationReason?: string | null;
};

function guildIconUrl(
  guildId: string | null | undefined,
  icon: string | null | undefined
): string | null {
  if (!guildId || !icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}

function guildInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const c = t[0];
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

function invalidHint(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason.startsWith("http_")) {
    return "Could not verify with Discord — tap Refresh or Replace.";
  }
  return null;
}

export function PromoServersView() {
  const [items, setItems] = useState<PromoLinkItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
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
          Paste Discord invite URLs (<code className={styles.inlineCode}>discord.gg/…</code>
          ). Duplicates are blocked. Cards show the server from Discord; broken invites are
          highlighted in red.
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
        <div className={styles.promoGrid}>
          {items.map((row) => {
            const expired = !row.valid;
            const repOpen = replacingId === row.id;
            const displayName = row.guildName?.trim() || "Discord server";
            const iconSrc = guildIconUrl(row.discordGuildId, row.guildIcon);
            const verifyHint = invalidHint(row.lastValidationReason ?? null);

            return (
              <article
                key={row.id}
                className={`${styles.promoTile} ${expired ? styles.promoTileExpired : ""}`}
              >
                <button
                  type="button"
                  className={styles.tileDeleteBtn}
                  aria-label="Remove link"
                  onClick={() => void removeLink(row.id)}
                >
                  <Trash2 size={15} strokeWidth={2} aria-hidden />
                </button>

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
                      {guildInitial(displayName)}
                    </div>
                  )}
                </div>

                <h3 className={styles.serverName}>{displayName}</h3>
                <p className={styles.meta}>
                  {typeof row.approximateMemberCount === "number" ? (
                    <>
                      {row.approximateMemberCount.toLocaleString()} members
                    </>
                  ) : (
                    <span style={{ opacity: 0.75 }}>Member count unavailable</span>
                  )}
                </p>

                <a
                  className={styles.joinBtn}
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join server
                  <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
                </a>

                <p className={styles.tileInviteUrl}>
                  <Link2 size={11} strokeWidth={2} aria-hidden />
                  <span>{row.url}</span>
                </p>

                <p className={styles.tileSubMeta}>
                  {formatExpires(row.expiresAt)}
                  {expired ? (
                    <span className={styles.promoExpiredBadge}>
                      {" "}
                      · Invalid or expired
                    </span>
                  ) : null}
                </p>
                {expired && verifyHint ? (
                  <p className={styles.tileVerifyHint}>{verifyHint}</p>
                ) : null}

                <div className={styles.tileFooter}>
                  {repOpen ? (
                    <div className={styles.replaceRow}>
                      <input
                        type="url"
                        className={styles.replaceInput}
                        placeholder="New invite URL"
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
                </div>
              </article>
            );
          })}
        </div>
      ) : loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : null}
    </div>
  );
}
