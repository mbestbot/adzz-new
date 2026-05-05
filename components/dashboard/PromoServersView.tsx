"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { channelNameMatchesAdvertisingOrSelling } from "@/components/dashboard/AddChannelModal";
import {
  useBots,
  type BotSummary,
} from "@/components/dashboard/BotContext";
import { UserProfileChip } from "@/components/dashboard/UserProfileChip";
import styles from "./advertisingServers.module.css";

type ApiChannel = { id: string; name: string; type: number };

type ApiGuild = {
  id: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  channels: ApiChannel[];
  updatedAt: number;
};

type DiscoveryGuildRow = {
  id: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  matchingChannels: { id: string; name: string }[];
  botLabels: string[];
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

function pickBetterServerName(prev: string, next: string): string {
  const s = String(next ?? "").trim();
  if (!s || /^unknown/i.test(s)) return String(prev ?? "").trim() || "Unknown server";
  const p = String(prev ?? "").trim();
  if (!p || /^unknown/i.test(p)) return s;
  return s.length > p.length ? s : p;
}

function botLabel(bot: BotSummary): string {
  return (
    String(bot.displayName ?? "").trim() ||
    String(bot.username ?? "").trim() ||
    String(bot.id).slice(0, 8)
  );
}

function matchingChannelsForGuild(g: ApiGuild): { id: string; name: string }[] {
  const list = (g.channels ?? []).filter(
    (c) =>
      c.type === 0 &&
      typeof c.name === "string" &&
      channelNameMatchesAdvertisingOrSelling(c.name)
  );
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function mergeDiscoveryRows(
  parts: { bot: BotSummary; guilds: ApiGuild[] }[]
): DiscoveryGuildRow[] {
  const byGuild = new Map<
    string,
    {
      id: string;
      name: string;
      icon: string | null;
      approximateMemberCount: number;
      channelById: Map<string, string>;
      botLabels: Set<string>;
    }
  >();

  for (const { bot, guilds } of parts) {
    const label = botLabel(bot);
    for (const g of guilds) {
      const gid = String(g.id ?? "").trim();
      if (!gid) continue;

      if (!byGuild.has(gid)) {
        byGuild.set(gid, {
          id: gid,
          name: String(g.name ?? "").trim() || "Unknown server",
          icon: g.icon ?? null,
          approximateMemberCount: Math.max(
            0,
            Math.floor(Number(g.approximateMemberCount) || 0)
          ),
          channelById: new Map(),
          botLabels: new Set(),
        });
      }
      const row = byGuild.get(gid)!;
      row.name = pickBetterServerName(row.name, String(g.name ?? ""));
      row.approximateMemberCount = Math.max(
        row.approximateMemberCount,
        Math.max(0, Math.floor(Number(g.approximateMemberCount) || 0))
      );
      if (g.icon != null && String(g.icon).trim()) row.icon = g.icon;
      row.botLabels.add(label);

      for (const ch of matchingChannelsForGuild(g)) {
        const cid = String(ch.id ?? "").trim();
        if (!cid) continue;
        const nm = String(ch.name ?? "").trim() || cid;
        if (!row.channelById.has(cid)) row.channelById.set(cid, nm);
      }
    }
  }

  const out: DiscoveryGuildRow[] = [];
  for (const row of byGuild.values()) {
    if (row.channelById.size === 0) continue;
    const matchingChannels = [...row.channelById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    out.push({
      id: row.id,
      name: row.name,
      icon: row.icon,
      approximateMemberCount: row.approximateMemberCount,
      matchingChannels,
      botLabels: [...row.botLabels].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    });
  }

  out.sort((a, b) => {
    if (b.approximateMemberCount !== a.approximateMemberCount) {
      return b.approximateMemberCount - a.approximateMemberCount;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return out;
}

function rowMatchesQuery(r: DiscoveryGuildRow, q: string): boolean {
  if (!q) return true;
  if (r.name.toLowerCase().includes(q)) return true;
  if (r.id.toLowerCase().includes(q)) return true;
  if (r.botLabels.some((b) => b.toLowerCase().includes(q))) return true;
  if (
    r.matchingChannels.some(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    )
  ) {
    return true;
  }
  return false;
}

const POLL_MS = 45_000;

export function PromoServersView() {
  const { bots } = useBots();
  const [rows, setRows] = useState<DiscoveryGuildRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [partialWarnings, setPartialWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const botsKey = useMemo(
    () =>
      [...bots]
        .map((b) => b.id)
        .sort()
        .join("|"),
    [bots]
  );

  const load = useCallback(async () => {
    if (!bots.length) {
      setRows([]);
      setPartialWarnings([]);
      setLoadErr(null);
      return;
    }
    setLoadErr(null);
    setLoading(true);
    try {
      const settled = await Promise.allSettled(
        bots.map((bot) =>
          apiFetch(`/api/bots/${encodeURIComponent(bot.id)}/guilds`).then(
            async (res) => {
              const data = (await res.json().catch(() => ({}))) as {
                guilds?: ApiGuild[];
                error?: string;
              };
              if (!res.ok) {
                throw new Error(
                  data.error ?? `Could not load guilds (${res.status})`
                );
              }
              return { bot, guilds: data.guilds ?? [] };
            }
          )
        )
      );

      const parts: { bot: BotSummary; guilds: ApiGuild[] }[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        const bot = bots[i];
        const label = botLabel(bot);
        if (s.status === "fulfilled") {
          parts.push(s.value);
        } else {
          const msg =
            s.reason instanceof Error ? s.reason.message : String(s.reason);
          warnings.push(`${label}: ${msg}`);
        }
      }

      setPartialWarnings(warnings);
      setRows(mergeDiscoveryRows(parts));
      if (warnings.length === settled.length) {
        setLoadErr(
          warnings.length === 1
            ? warnings[0]
            : "Could not load servers from any bot."
        );
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load servers");
      setRows(null);
      setPartialWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [bots]);

  useEffect(() => {
    void load();
  }, [load, botsKey]);

  useEffect(() => {
    if (!bots.length) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [botsKey, load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && bots.length) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [bots.length, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((r) => rowMatchesQuery(r, q));
  }, [rows, query]);

  if (!bots.length) {
    return (
      <div className={styles.wrap}>
        <div style={{ marginBottom: "1rem" }}>
          <UserProfileChip />
        </div>
        <p className={styles.empty}>
          Add a bot from the profile menu. This page lists Discord servers from{" "}
          <strong>all</strong> your bots that have advertising- or selling-style text
          channels (deduplicated).
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div style={{ marginBottom: "1rem" }}>
        <UserProfileChip />
      </div>

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
          Discovery
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
          Server discovery
        </h1>
        <p className={styles.lead}>
          Servers from <strong>every bot</strong> on your account, merged into one list
          with <strong>no duplicates</strong>. Only guilds that have at least one text
          channel matching <strong>advertising</strong> or <strong>selling</strong>{" "}
          naming (same rules as ad-focused picks when you add a channel). Refresh{" "}
          <strong>Servers</strong> per bot if a server is missing. Adding a new bot
          reloads this list automatically.
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} strokeWidth={2} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search server, channel, guild id, bot name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search discovery servers"
          />
        </div>
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

      {loadErr ? (
        <p style={{ color: "var(--dash-amber)", marginBottom: "1rem" }} role="alert">
          {loadErr}
        </p>
      ) : null}

      {partialWarnings.length > 0 && !loadErr ? (
        <p
          style={{ color: "var(--dash-amber)", marginBottom: "1rem", fontSize: "0.85rem" }}
          role="status"
        >
          {partialWarnings.length === 1
            ? partialWarnings[0]
            : `Some bots could not load: ${partialWarnings.join(" · ")}`}
        </p>
      ) : null}

      {!loading && rows !== null && filtered.length === 0 ? (
        <p className={styles.empty}>
          {rows.length === 0
            ? "No matching servers yet — open Servers and sync from Discord for each bot, or none of your cached guilds have advertising / selling channel names."
            : "No servers match your search."}
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((r) => {
            const iconSrc = guildIconUrl(r.id, r.icon);
            const preview = r.matchingChannels
              .slice(0, 4)
              .map((c) => `#${c.name}`)
              .join(" · ");
            const firstCh = r.matchingChannels[0];
            const discordUrl = firstCh
              ? `https://discord.com/channels/${r.id}/${firstCh.id}`
              : `https://discord.com/channels/${r.id}`;
            const botSummary =
              r.botLabels.length <= 2
                ? r.botLabels.join(" · ")
                : `${r.botLabels.slice(0, 2).join(" · ")} +${r.botLabels.length - 2}`;
            return (
              <article key={r.id} className={styles.card}>
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
                <p className={styles.meta}>
                  {r.approximateMemberCount.toLocaleString()} members ·{" "}
                  {r.matchingChannels.length} channel
                  {r.matchingChannels.length !== 1 ? "s" : ""}
                </p>
                <p className={styles.botLine} title={r.botLabels.join(", ")}>
                  {r.botLabels.length} bot{r.botLabels.length !== 1 ? "s" : ""}:{" "}
                  {botSummary}
                </p>
                <p className={styles.channelsPreview} title={preview}>
                  {preview}
                  {r.matchingChannels.length > 4 ? "…" : ""}
                </p>
                <a
                  className={styles.openLink}
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Discord
                  <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
                </a>
              </article>
            );
          })}
        </div>
      ) : loading && rows === null && !loadErr ? (
        <p className={styles.empty}>Loading servers…</p>
      ) : null}
    </div>
  );
}
