"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import styles from "./add-bot-modal.module.css";
import s from "./servers.module.css";

type ApiChannel = { id: string; name: string; type: number };

const NAME_KEYWORDS = [
  "advertisement",
  "ads",
  "discord",
  "selling",
  "seller",
] as const;

/** Ad-style channels: advertisement, ads, or the word “ad”. */
export function channelNameMatchesAdvertisingFocus(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("advertisement")) return true;
  if (n.includes("ads")) return true;
  return /\bad\b/i.test(name);
}

/** Trade / seller channels. */
export function channelNameMatchesSellingFocus(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("selling") || n.includes("seller");
}

/** Same filter as “Add channel” without “Show all” (suggested picks). */
export function channelNameMatchesAdKeywords(name: string): boolean {
  const n = name.toLowerCase();
  for (const k of NAME_KEYWORDS) {
    if (n.includes(k)) return true;
  }
  return /\bad\b/i.test(name);
}

/** Discovery list: advertising-style or selling / seller channels only (no generic “discord” keyword). */
export function channelNameMatchesAdvertisingOrSelling(name: string): boolean {
  return (
    channelNameMatchesAdvertisingFocus(name) ||
    channelNameMatchesSellingFocus(name)
  );
}

/** Guild browse: any channel that looks like ads / promo / selling (union of heuristics above). */
export function channelNameMatchesPromoDiscovery(name: string): boolean {
  return (
    channelNameMatchesAdvertisingOrSelling(name) ||
    channelNameMatchesAdKeywords(name)
  );
}

type AddChannelModalProps = {
  open: boolean;
  onClose: () => void;
  guildName: string;
  /** Discord guild (server) snowflake */
  guildId: string;
  /** Bot that owns the guild cache row */
  botId: string;
  channels: ApiChannel[];
  alreadyAddedIds: ReadonlySet<string>;
  onPick: (channel: ApiChannel) => void;
  /** Called after a successful Discord refresh so parent can update local guild cache */
  onChannelsUpdated?: (channels: ApiChannel[]) => void;
};

export function AddChannelModal({
  open,
  onClose,
  guildName,
  guildId,
  botId,
  channels,
  alreadyAddedIds,
  onPick,
  onChannelsUpdated,
}: AddChannelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setShowAll(false);
      setChannelQuery("");
    }
  }, [open, guildName, guildId]);

  const textChannels = useMemo(
    () =>
      [...channels]
        .filter((c) => c.type === 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [channels]
  );

  const keywordFiltered = useMemo(() => {
    if (showAll) return textChannels;
    return textChannels.filter((c) => channelNameMatchesAdKeywords(c.name));
  }, [showAll, textChannels]);

  const visibleChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    if (!q) return keywordFiltered;
    return keywordFiltered.filter((c) => c.name.toLowerCase().includes(q));
  }, [channelQuery, keywordFiltered]);

  const onRefreshFromDiscord = async () => {
    if (!botId || !guildId) return;
    setRefreshing(true);
    try {
      const res = await apiFetch(
        `/api/bots/${encodeURIComponent(botId)}/guilds/${encodeURIComponent(guildId)}/channels/refresh`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        channels?: ApiChannel[];
        error?: string;
      };
      if (!res.ok) {
        window.alert(
          data.error ?? `Could not refresh channels from Discord (${res.status})`
        );
        return;
      }
      const next = data.channels ?? [];
      onChannelsUpdated?.(next);
    } finally {
      setRefreshing(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div
        className={styles.panel}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.headTitle}>Add channel · {guildName}</h2>
            <p className={styles.headSub}>
              Suggested names match: Ad, advertisement, ads, discord, selling,
              seller. Turn on <strong>Show all</strong> to pick any text channel.
              Use <strong>Refresh</strong> to pull the latest channel list from
              Discord (updates saved cache).
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={s.addChannelToolbar}>
            <div className={s.addChannelSearchWrap}>
              <Search
                size={16}
                strokeWidth={2}
                className={s.addChannelSearchIcon}
                aria-hidden
              />
              <input
                type="search"
                className={s.addChannelSearchInput}
                placeholder="Search channels…"
                value={channelQuery}
                onChange={(e) => setChannelQuery(e.target.value)}
                aria-label="Search channels"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className={s.addChannelRefreshBtn}
              onClick={() => void onRefreshFromDiscord()}
              disabled={!botId || !guildId || refreshing}
              title="Fetch latest channels from Discord for this server and update cache"
            >
              <RefreshCw
                size={15}
                strokeWidth={2}
                className={refreshing ? s.addChannelRefreshSpin : undefined}
                aria-hidden
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <label className={s.addChannelToggleRow}>
            <input
              type="checkbox"
              className={s.addChannelToggleInput}
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              disabled={refreshing}
            />
            <span>Show all channels</span>
          </label>

          {keywordFiltered.length === 0 ? (
            <p className={styles.headSub} style={{ marginTop: "0.5rem" }}>
              {showAll
                ? "No text channels in cache for this server. Try Refresh."
                : "No channels match the keyword filter. Enable “Show all channels” or use Refresh / Refresh from Discord on the Servers page."}
            </p>
          ) : visibleChannels.length === 0 ? (
            <p className={styles.headSub} style={{ marginTop: "0.5rem" }}>
              No channels match “{channelQuery.trim()}”. Try a different search or
              turn on Show all channels.
            </p>
          ) : (
            <ul className={s.addChannelPickList} role="listbox" aria-label="Channels">
              {visibleChannels.map((c) => {
                const taken = alreadyAddedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      className={`${s.addChannelPickItem} ${taken ? s.addChannelPickItemDisabled : ""}`}
                      disabled={taken || refreshing}
                      onClick={() => {
                        if (taken) return;
                        onPick(c);
                        onClose();
                      }}
                    >
                      <span className={s.addChannelPickName}>#{c.name}</span>
                      {taken ? (
                        <span className={s.addChannelPickHint}>Added</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
