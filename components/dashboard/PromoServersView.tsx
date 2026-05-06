"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import styles from "./advertisingServers.module.css";

type DiscoveryServer = {
  discordGuildId: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  updatedAt: number;
  /** discord.gg invite — discovery never uses channel deep links */
  joinDiscordUrl?: string;
};

type DiscoveryResponse = {
  servers?: DiscoveryServer[];
  generatedAt?: number | null;
  error?: string;
};

type FetchLinksResponse = {
  ok?: boolean;
  servers?: DiscoveryServer[];
  generatedAt?: number | null;
  error?: string;
};

const FETCH_LINKS_TIMEOUT_MS = 600_000;

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

function rowMatchesQuery(r: DiscoveryServer, q: string): boolean {
  if (!q) return true;
  if (r.name.toLowerCase().includes(q)) return true;
  if (r.discordGuildId.toLowerCase().includes(q)) return true;
  return false;
}

const POLL_MS = 60_000;

export function PromoServersView() {
  const [servers, setServers] = useState<DiscoveryServer[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLinksBusy, setFetchLinksBusy] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (mode: "full" | "quiet" = "full") => {
    const noisy = mode === "full";
    if (noisy) {
      setLoadErr(null);
      setLoading(true);
    }
    try {
      const res = await apiFetch("/api/discovery/posting-servers");
      const data = (await res.json().catch(() => ({}))) as DiscoveryResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `Load failed (${res.status})`);
      }
      setServers(data.servers ?? []);
      setGeneratedAt(
        data.generatedAt != null && Number.isFinite(data.generatedAt)
          ? data.generatedAt
          : null
      );
      setLoadErr(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load servers";
      if (noisy) setLoadErr(msg);
      else setLoadErr((prev) => prev ?? msg);
    } finally {
      if (noisy) setLoading(false);
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    setFetchLinksBusy(true);
    setLoadErr(null);
    try {
      const res = await apiFetch(
        "/api/discovery/fetch-links",
        { method: "POST", body: JSON.stringify({}) },
        { timeoutMs: FETCH_LINKS_TIMEOUT_MS }
      );
      const data = (await res.json().catch(() => ({}))) as FetchLinksResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `Fetch links failed (${res.status})`);
      }
      setServers(data.servers ?? []);
      setGeneratedAt(
        data.generatedAt != null && Number.isFinite(data.generatedAt)
          ? data.generatedAt
          : null
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Fetch links failed");
    } finally {
      setFetchLinksBusy(false);
    }
  }, []);

  useEffect(() => {
    void load("full");
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void load("quiet");
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load("quiet");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!servers) return [];
    if (!q) return servers;
    return servers.filter((r) => rowMatchesQuery(r, q));
  }, [servers, query]);

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
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} strokeWidth={2} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by server name or guild id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search discovery servers"
          />
        </div>
        <button
          type="button"
          className={styles.fetchLinksBtn}
          disabled={loading || fetchLinksBusy}
          onClick={() => void fetchLinks()}
        >
          <Link2 size={14} strokeWidth={2} aria-hidden />
          {fetchLinksBusy ? "Fetching links…" : "Fetch links"}
        </button>
        <button
          type="button"
          className={styles.refreshBtn}
          disabled={loading || fetchLinksBusy}
          onClick={() => void load("full")}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {generatedAt ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--dash-muted)",
            margin: "-0.35rem 0 1rem",
          }}
        >
          Catalog refreshed{" "}
          <time dateTime={new Date(generatedAt).toISOString()}>
            {new Date(generatedAt).toLocaleString()}
          </time>
          .
        </p>
      ) : null}

      {loadErr ? (
        <p style={{ color: "var(--dash-amber)", marginBottom: "1rem" }} role="alert">
          {loadErr}
        </p>
      ) : null}

      {!loading && servers !== null && filtered.length === 0 ? (
        <p className={styles.empty}>
          {servers.length === 0
            ? "No active posting servers to show yet — when customers link channels and campaigns run, those Discord guilds appear here."
            : "No servers match your search."}
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((r) => {
            const iconSrc = guildIconUrl(r.discordGuildId, r.icon);
            return (
              <article key={r.discordGuildId} className={styles.card}>
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
                  {r.approximateMemberCount.toLocaleString()} members
                </p>
                {r.joinDiscordUrl ? (
                  <a
                    className={styles.openLink}
                    href={r.joinDiscordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join server
                    <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
                  </a>
                ) : (
                  <span
                    className={styles.joinUnavailable}
                    title="No invite link yet — the posting bot needs Manage Server or Create Invite on this guild."
                  >
                    Invite unavailable
                  </span>
                )}
              </article>
            );
          })}
        </div>
      ) : loading && servers === null && !loadErr ? (
        <p className={styles.empty}>Loading servers…</p>
      ) : null}
    </div>
  );
}
