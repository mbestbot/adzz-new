"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Check,
  ChevronDown,
  Copy,
  Image,
  MoreHorizontal,
  RefreshCw,
  Search,
  Wrench,
  Wand2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { readLegacyLinkedChannelsMinimal } from "@/lib/linkedChannelsStorage";
import { UserProfileChip } from "./UserProfileChip";
import { useBots } from "./BotContext";
import {
  AddChannelModal,
  channelNameMatchesAdvertisingFocus,
  channelNameMatchesAdKeywords,
  channelNameMatchesSellingFocus,
} from "./AddChannelModal";
import {
  AutoConfigureChannelsModal,
  type AutoConfigureMode,
} from "./AutoConfigureChannelsModal";
import { FixBotModal } from "./FixBotModal";
import styles from "./servers.module.css";

/** Poll GET guilds while POST /guilds/sync runs so partial backend writes show up in the UI. */
function startGuildListPolling(
  load: () => Promise<unknown>,
  intervalMs: number
): () => void {
  void load();
  const id = window.setInterval(() => void load(), intervalMs);
  return () => window.clearInterval(id);
}

/** Minimal slice of GET /api/messages-state for Servers channel badges. */
type MessagesStateForServers = {
  uiMode?: string;
  adPool?: {
    messages?: string[];
    intervalMs?: number;
    targets?: {
      botId: string;
      channelId: string;
      paused?: boolean;
      lastSendError?: string | null;
      lastSentAt?: number | null;
      lastSendErrorAt?: number | null;
      discordSlowmodeSec?: number | null;
      guildId?: string;
      discordGuildId?: string;
      adsSentTotal?: number;
    }[];
  } | null;
};

/** Keep Discord snowflakes as strings end-to-end (avoid Number() precision loss). */
function discordId(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Backend stores friendly 429 copy; treat as "waiting on Discord", not a hard fault. */
function isDiscordRateLimitMessage(msg: unknown): boolean {
  if (msg == null) return false;
  return /429|rate limited/i.test(String(msg).trim());
}

type ChannelStatus = "active" | "paused" | "error" | "inactive";

type ChannelRow = {
  id: string;
  name: string;
  status: ChannelStatus;
  interval: string;
  intervalTitle?: string;
  slowDown: string;
  slowDownTitle?: string;
  /** Last successful delivery (not attempts or checks). */
  lastSent: string;
  lastSentTitle?: string;
  lastRun: string;
  lastRunTitle?: string;
  messagesSent: string;
};

type ServerSummary = {
  id: string;
  name: string;
  accent: string;
  members: number;
  adsSent: number;
  channelTotal: number;
};

type ServerWithLinked = ServerSummary & { linkedChannels: ChannelRow[] };

type ApiChannel = { id: string; name: string; type: number };

type ApiGuild = {
  id: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  channels: ApiChannel[];
  updatedAt: number;
};

function formatMembers(n: number) {
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return n.toLocaleString();
}

function formatLastRunAt(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return d.toLocaleString(undefined, opts);
}

function formatCooldownSeconds(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.max(1, Math.round(s / 60));
    return `${m} min`;
  }
  if (s < 86400) {
    const h = s / 3600;
    const label =
      h >= 10
        ? String(Math.round(h))
        : String(Math.round(h * 10) / 10).replace(/\.0$/, "");
    return `${label} h`;
  }
  const d = Math.max(1, Math.round(s / 86400));
  return `${d} d`;
}

function formatRelativeLastRun(atMs: number, nowMs: number): string {
  const delta = Math.max(0, nowMs - atMs);
  const sec = Math.floor(delta / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} d ago`;
  return formatLastRunAt(atMs);
}

function accentFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 52%, 42%)`;
}

function guildIconUrl(guildId: string, icon: string | null) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64`;
}

function summariesFromGuilds(rows: ApiGuild[]): ServerSummary[] {
  return rows.map((g) => {
    const chans = g.channels ?? [];
    return {
      id: g.id,
      name: g.name,
      accent: accentFromId(g.id),
      members: g.approximateMemberCount ?? 0,
      adsSent: 0,
      channelTotal: chans.length,
    };
  });
}

/** Must match backend `PERMISSION_SEND_ERROR` */
const CHANNEL_PERMISSION_ERROR =
  "No permission to send messages in this channel.";

/**
 * Probe Discord for channels that have user slowmode but no successful send on record,
 * so slowmode seconds stay accurate without posting.
 */
const SLOWMODE_NO_SEND_PROBE_MS = 20 * 60 * 1000;

function rowsFromServerLinks(
  fromServer: Record<string, { id: string; name: string }[]> | undefined
): Record<string, ChannelRow[]> {
  const out: Record<string, ChannelRow[]> = {};
  if (!fromServer) return out;
  for (const [gid, chans] of Object.entries(fromServer)) {
    if (!chans?.length) continue;
    out[gid] = chans.map((c) => ({
      id: c.id,
      name: c.name,
      status: "inactive" as ChannelStatus,
      interval: "—",
      slowDown: "—",
      lastSent: "—",
      lastRun: "—",
      messagesSent: "—",
    }));
  }
  return out;
}

function toMinimalGuildChannels(
  map: Record<string, ChannelRow[]>
): Record<string, { id: string; name: string }[]> {
  const out: Record<string, { id: string; name: string }[]> = {};
  for (const [gid, rows] of Object.entries(map)) {
    if (!rows?.length) continue;
    out[gid] = rows.map((r) => ({ id: r.id, name: r.name }));
  }
  return out;
}

function statusBadgeClass(s: ChannelStatus) {
  switch (s) {
    case "active":
      return styles.badgeActive;
    case "paused":
      return styles.badgePaused;
    case "error":
      return styles.badgeError;
    default:
      return styles.badgeInactive;
  }
}

function statusLabel(s: ChannelStatus) {
  switch (s) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    default:
      return "Inactive";
  }
}

type MetricId = "servers" | "active" | "paused" | "errors";

type FetchBannerState =
  | null
  | {
      title: string;
      mode: "determinate" | "indeterminate";
      /** Static bar (no animation) when ease is omitted */
      percent?: number;
      /** Eased bar: animates quickly then slows toward max while work runs */
      ease?: { min: number; max: number };
    };

function ChannelActionsMenu({
  channelName,
  onRemove,
  pauseSupported,
  channelPaused,
  onPauseResume,
}: {
  channelName: string;
  onRemove: () => void;
  pauseSupported: boolean;
  channelPaused: boolean;
  onPauseResume: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.right });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const dropdown =
    open && mounted ? (
      <div
        ref={menuRef}
        className={styles.dropdown}
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          right: "auto",
          transform: "translateX(-100%)",
          zIndex: 400,
        }}
        role="menu"
      >
        <button type="button" className={styles.dropdownItem} role="menuitem">
          Edit schedule
        </button>
        <button
          type="button"
          className={styles.dropdownItem}
          role="menuitem"
          disabled={!pauseSupported}
          title={
            pauseSupported
              ? undefined
              : "Open Messages and leave the page open a moment — targets auto-save to the server"
          }
          onClick={() => {
            if (!pauseSupported) return;
            setOpen(false);
            void onPauseResume();
          }}
        >
          {channelPaused ? "Resume channel" : "Pause channel"}
        </button>
        <button
          type="button"
          className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onRemove();
          }}
        >
          Remove channel
        </button>
      </div>
    ) : null;

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.rowMenu}
        aria-label={`Actions for ${channelName}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>
      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}

type BotDiscordStatus =
  | { phase: "loading" }
  | { phase: "ready"; active: boolean; error?: string }
  | { phase: "failed"; message: string };

export function ServersView() {
  const {
    activeBotId,
    bots,
    syncGuilds,
    syncing,
    refreshBots,
    refreshBotProfile,
    serverUiLinksByBot,
    refreshServerUiLinks,
    saveServerUiLinks,
  } = useBots();
  const [metricId, setMetricId] = useState<MetricId>("servers");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [rawGuilds, setRawGuilds] = useState<ApiGuild[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [toolbarFlash, setToolbarFlash] = useState<string | null>(null);
  const [loginScriptBusy, setLoginScriptBusy] = useState(false);
  const [refreshingPfp, setRefreshingPfp] = useState(false);
  const [fullReloading, setFullReloading] = useState(false);
  const [fetchBanner, setFetchBanner] = useState<FetchBannerState>(null);
  const [syncBarPercent, setSyncBarPercent] = useState(0);
  const syncBarProgressRef = useRef(0);
  const syncBarStopRef = useRef(false);
  const syncAnimFrameRef = useRef<number | null>(null);
  const [addChannelForGuildId, setAddChannelForGuildId] = useState<
    string | null
  >(null);
  const [autoConfigureOpen, setAutoConfigureOpen] = useState(false);
  const [autoConfigureApplying, setAutoConfigureApplying] = useState(false);
  const [linkedByGuild, setLinkedByGuild] = useState<Record<string, ChannelRow[]>>(
    {}
  );
  const [discordStatus, setDiscordStatus] = useState<BotDiscordStatus>({
    phase: "loading",
  });
  const [checkingChannelId, setCheckingChannelId] = useState<string | null>(
    null
  );
  const checkAbortByChannelRef = useRef<Map<string, AbortController>>(
    new Map()
  );
  const linkedMigrateDoneRef = useRef<Set<string>>(new Set());
  const [wallNow, setWallNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setWallNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const [adCampaign, setAdCampaign] = useState<{
    enabled: boolean;
    runningChannelIds: Set<string>;
    pausedChannelIds: Set<string>;
    listedChannelIds: Set<string>;
    channelErrors: Record<string, string>;
    intervalSeconds: number | null;
    channelIntervalSeconds: Record<string, number>;
    channelLastSentAt: Record<string, number | null>;
    channelLastSendErrorAt: Record<string, number | null>;
    channelDiscordSlowmodeSec: Record<string, number | null>;
    guildAdsSent: Record<string, number>;
    channelAdsSent: Record<string, number>;
  }>({
    enabled: false,
    runningChannelIds: new Set(),
    pausedChannelIds: new Set(),
    listedChannelIds: new Set(),
    channelErrors: {},
    intervalSeconds: null,
    channelIntervalSeconds: {},
    channelLastSentAt: {},
    channelLastSendErrorAt: {},
    channelDiscordSlowmodeSec: {},
    guildAdsSent: {},
    channelAdsSent: {},
  });
  const slowmodeProbeAttemptedRef = useRef<Set<string>>(new Set());
  /** After probe failures (e.g. gateway 502), pause probes to avoid hammering the API. */
  const channelProbeCooldownUntilRef = useRef(0);
  const [probeCooldownEpoch, setProbeCooldownEpoch] = useState(0);
  const adCampaignRef = useRef(adCampaign);
  const linkedByGuildRef = useRef(linkedByGuild);

  useEffect(() => {
    adCampaignRef.current = adCampaign;
  }, [adCampaign]);
  useEffect(() => {
    linkedByGuildRef.current = linkedByGuild;
  }, [linkedByGuild]);

  const fetchAdCampaign = useCallback(async () => {
    if (!activeBotId) {
      setAdCampaign({
        enabled: false,
        runningChannelIds: new Set(),
        pausedChannelIds: new Set(),
        listedChannelIds: new Set(),
        channelErrors: {},
        intervalSeconds: null,
        channelIntervalSeconds: {},
        channelLastSentAt: {},
        channelLastSendErrorAt: {},
        channelDiscordSlowmodeSec: {},
        guildAdsSent: {},
        channelAdsSent: {},
      });
      slowmodeProbeAttemptedRef.current = new Set();
      return;
    }
    const [res, msgRes] = await Promise.all([
      apiFetch("/api/ad-campaign"),
      apiFetch("/api/messages-state"),
    ]);
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ServersView] /api/ad-campaign failed", res.status);
      }
      return;
    }
    let msgState: MessagesStateForServers | null = null;
    if (msgRes.ok) {
      msgState = (await msgRes.json()) as MessagesStateForServers;
    }
    const data = (await res.json()) as {
      campaigns?: {
        enabled?: boolean;
        message?: string;
        intervalMs?: number;
        targets?: {
          botId: string;
          channelId: string;
          paused?: boolean;
          lastSendError?: string | null;
          lastSentAt?: number | null;
          lastSendErrorAt?: number | null;
          discordSlowmodeSec?: number | null;
          guildId?: string;
          adsSentTotal?: number;
        }[];
      }[];
    };
    const campaigns = data.campaigns ?? [];
    /** Pool config persists while uiMode is Basic; stats stay on these targets. */
    const adPoolState = msgState?.adPool ?? null;
    const poolHasTargets = (adPoolState?.targets?.length ?? 0) > 0;
    const poolHasMessage =
      Array.isArray(adPoolState?.messages) &&
      adPoolState.messages.some((m) => String(m ?? "").trim().length > 0);
    /** Scheduler only posts from the pool when Messages is on the Ad pool tab. */
    const poolPostingActive =
      msgState?.uiMode === "adpool" && poolHasTargets && poolHasMessage;
    const anyEnabled = campaigns.length > 0 || poolHasTargets;
    const running = new Set<string>();
    const paused = new Set<string>();
    const listed = new Set<string>();
    const channelErrors: Record<string, string> = {};
    const channelLastSentAt: Record<string, number | null> = {};
    const channelLastSendErrorAt: Record<string, number | null> = {};
    const channelDiscordSlowmodeSec: Record<string, number | null> = {};
    const channelIntervalSeconds: Record<string, number> = {};
    const channelAdsSent: Record<string, number> = {};
    const channelToGuild: Record<string, string> = {};
    let globalMinInterval: number | null = null;

    const ingestTargetsForBot = (
      targets: {
        botId: string;
        channelId: string;
        paused?: boolean;
        lastSendError?: string | null;
        lastSentAt?: number | null;
        lastSendErrorAt?: number | null;
        discordSlowmodeSec?: number | null;
        guildId?: string;
        discordGuildId?: string;
        adsSentTotal?: number;
      }[],
      campIntervalSec: number | null,
      campHasCopy: boolean,
      countsAsRunning = true
    ) => {
      for (const t of targets ?? []) {
        if (discordId(t.botId) !== discordId(activeBotId)) continue;
        const chId = discordId(t.channelId);
        if (!chId) continue;
        listed.add(chId);
        const sentAt =
          t.lastSentAt != null && Number.isFinite(Number(t.lastSentAt))
            ? Number(t.lastSentAt)
            : null;
        const prevAt = channelLastSentAt[chId];
        if (sentAt != null && (prevAt == null || sentAt > prevAt)) {
          channelLastSentAt[chId] = sentAt;
        }
        const errT =
          t.lastSendErrorAt != null &&
          Number.isFinite(Number(t.lastSendErrorAt))
            ? Number(t.lastSendErrorAt)
            : null;
        const prevErrT = channelLastSendErrorAt[chId];
        if (errT != null && (prevErrT == null || errT > prevErrT)) {
          channelLastSendErrorAt[chId] = errT;
        }
        const discSm =
          t.discordSlowmodeSec != null &&
          Number.isFinite(Number(t.discordSlowmodeSec))
            ? Math.max(0, Number(t.discordSlowmodeSec))
            : null;
        const curSm = channelDiscordSlowmodeSec[chId];
        if (discSm != null) {
          channelDiscordSlowmodeSec[chId] =
            curSm == null ? discSm : Math.max(curSm, discSm);
        } else if (curSm === undefined) {
          channelDiscordSlowmodeSec[chId] = null;
        }
        const sent =
          t.adsSentTotal != null && Number.isFinite(Number(t.adsSentTotal))
            ? Math.max(0, Math.floor(Number(t.adsSentTotal)))
            : 0;
        channelAdsSent[chId] = Math.max(channelAdsSent[chId] ?? 0, sent);
        const gid = String(
          t.guildId ?? t.discordGuildId ?? ""
        ).trim();
        if (gid) channelToGuild[chId] = gid;
        const le = t.lastSendError;
        if (le != null && String(le).trim()) {
          if (!channelErrors[chId]) {
            channelErrors[chId] = String(le);
          }
        }
        if (campIntervalSec != null) {
          const prevI = channelIntervalSeconds[chId];
          if (prevI == null || campIntervalSec < prevI) {
            channelIntervalSeconds[chId] = campIntervalSec;
          }
        }
        if (t.paused) paused.add(chId);
        else if (campHasCopy && countsAsRunning) running.add(chId);
      }
    };

    for (const c of campaigns) {
      const intervalMs =
        c?.intervalMs != null ? Number(c.intervalMs) : Number.NaN;
      const campIntervalSec =
        Number.isFinite(intervalMs) && intervalMs > 0
          ? Math.max(1, Math.round(intervalMs / 1000))
          : null;
      const campHasMessage = String(c.message ?? "").trim().length > 0;
      const touchesBot = (c.targets ?? []).some(
        (t) => discordId(t.botId) === discordId(activeBotId)
      );
      if (
        touchesBot &&
        campIntervalSec != null &&
        (globalMinInterval == null || campIntervalSec < globalMinInterval)
      ) {
        globalMinInterval = campIntervalSec;
      }

      ingestTargetsForBot(c.targets ?? [], campIntervalSec, campHasMessage);
    }

    if (adPoolState?.targets?.length) {
      const intervalMs =
        adPoolState.intervalMs != null
          ? Number(adPoolState.intervalMs)
          : Number.NaN;
      const campIntervalSec =
        Number.isFinite(intervalMs) && intervalMs > 0
          ? Math.max(1, Math.round(intervalMs / 1000))
          : null;
      const touchesBot = adPoolState.targets.some(
        (t) => discordId(t.botId) === discordId(activeBotId)
      );
      if (
        touchesBot &&
        campIntervalSec != null &&
        (globalMinInterval == null || campIntervalSec < globalMinInterval)
      ) {
        globalMinInterval = campIntervalSec;
      }
      ingestTargetsForBot(
        adPoolState.targets,
        campIntervalSec,
        poolHasMessage,
        poolPostingActive
      );
    }
    const guildAdsSent: Record<string, number> = {};
    for (const chId of Object.keys(channelAdsSent)) {
      const gid = channelToGuild[chId];
      if (!gid) continue;
      guildAdsSent[gid] =
        (guildAdsSent[gid] ?? 0) + (channelAdsSent[chId] ?? 0);
    }
    setAdCampaign({
      enabled: anyEnabled,
      runningChannelIds: running,
      pausedChannelIds: paused,
      listedChannelIds: listed,
      channelErrors,
      intervalSeconds: globalMinInterval,
      channelIntervalSeconds,
      channelLastSentAt,
      channelLastSendErrorAt,
      channelDiscordSlowmodeSec,
      guildAdsSent,
      channelAdsSent,
    });
  }, [activeBotId]);

  const loadGuilds = useCallback(async () => {
    if (!activeBotId) {
      setRawGuilds([]);
      return;
    }
    setLoadError(null);
    const res = await apiFetch(`/api/bots/${activeBotId}/guilds`);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setLoadError(data.error ?? `Load failed (${res.status})`);
      setRawGuilds([]);
      return;
    }
    const data = (await res.json()) as { guilds: ApiGuild[] };
    setRawGuilds(data.guilds ?? []);
  }, [activeBotId]);

  useEffect(() => {
    void loadGuilds();
  }, [loadGuilds]);

  const activeBotAccountEmail = useMemo(() => {
    if (!activeBotId) return null;
    return bots.find((b) => b.id === activeBotId)?.accountEmail ?? null;
  }, [activeBotId, bots]);

  const fetchDiscordConnectionStatus = useCallback(async () => {
    if (!activeBotId) return;
    setDiscordStatus({ phase: "loading" });
    try {
      const res = await apiFetch(`/api/bots/${activeBotId}/status`);
      const data = (await res.json()) as {
        active?: boolean;
        error?: string;
      };
      if (!res.ok) {
        const msg =
          typeof data === "object" && data && "error" in data && data.error
            ? String(data.error)
            : `Status failed (${res.status})`;
        setDiscordStatus({ phase: "failed", message: msg });
        return;
      }
      setDiscordStatus({
        phase: "ready",
        active: Boolean(data.active),
        error: data.error,
      });
    } catch (e) {
      setDiscordStatus({
        phase: "failed",
        message: e instanceof Error ? e.message : "Could not reach API",
      });
    }
  }, [activeBotId]);

  useEffect(() => {
    if (!activeBotId) return;
    void fetchDiscordConnectionStatus();
  }, [activeBotId, fetchDiscordConnectionStatus]);

  useEffect(() => {
    if (!activeBotId) return;
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      void fetchAdCampaign();
    }, 3000);
    return () => window.clearInterval(id);
  }, [activeBotId, fetchAdCampaign]);

  const listedIdsKey = useMemo(
    () => [...adCampaign.listedChannelIds].sort().join(","),
    [adCampaign.listedChannelIds]
  );

  useEffect(() => {
    slowmodeProbeAttemptedRef.current = new Set();
    channelProbeCooldownUntilRef.current = 0;
  }, [activeBotId]);

  useEffect(() => {
    if (!activeBotId || !listedIdsKey) return;
    if (Date.now() < channelProbeCooldownUntilRef.current) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const listed = adCampaignRef.current.listedChannelIds;
    const slow = adCampaignRef.current.channelDiscordSlowmodeSec;
    const toProbe: string[] = [];
    for (const rows of Object.values(linkedByGuild)) {
      for (const ch of rows ?? []) {
        const cid = discordId(ch.id);
        if (!listed.has(cid)) continue;
        if (slowmodeProbeAttemptedRef.current.has(cid)) continue;
        if (slow[cid] != null) {
          slowmodeProbeAttemptedRef.current.add(cid);
          continue;
        }
        toProbe.push(cid);
      }
    }
    if (!toProbe.length) return;

    let cancelled = false;
    void (async () => {
      for (const channelId of toProbe) {
        if (cancelled) break;
        if (Date.now() < channelProbeCooldownUntilRef.current) break;
        slowmodeProbeAttemptedRef.current.add(channelId);
        const res = await apiFetch(
          "/api/ad-campaign/probe-channel",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ botId: activeBotId, channelId }),
          },
          { timeoutMs: 45_000, quietLog: true }
        );
        if (!res.ok) {
          channelProbeCooldownUntilRef.current = Date.now() + 120_000;
          window.setTimeout(() => {
            setProbeCooldownEpoch((n) => n + 1);
          }, 121_000);
          break;
        }
        if (!cancelled) {
          await fetchAdCampaign();
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBotId, listedIdsKey, linkedByGuild, fetchAdCampaign, probeCooldownEpoch]);

  useEffect(() => {
    if (!activeBotId) return;
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void (async () => {
        if (Date.now() < channelProbeCooldownUntilRef.current) return;
        const ac = adCampaignRef.current;
        const lb = linkedByGuildRef.current;
        if (!ac.enabled) return;
        const listed = ac.listedChannelIds;
        const slow = ac.channelDiscordSlowmodeSec;
        const lastSentMap = ac.channelLastSentAt;
        const paused = ac.pausedChannelIds;
        const toProbe: string[] = [];
        for (const rows of Object.values(lb)) {
          for (const ch of rows ?? []) {
            const cid = discordId(ch.id);
            if (!listed.has(cid)) continue;
            if (paused.has(cid)) continue;
            const sm = slow[cid];
            if (sm == null || sm <= 0) continue;
            const sentAt = lastSentMap[cid];
            if (sentAt != null && Number.isFinite(Number(sentAt))) continue;
            if (!toProbe.includes(cid)) toProbe.push(cid);
          }
        }
        for (const channelId of toProbe) {
          if (Date.now() < channelProbeCooldownUntilRef.current) break;
          const res = await apiFetch(
            "/api/ad-campaign/probe-channel",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ botId: activeBotId, channelId }),
            },
            { timeoutMs: 45_000, quietLog: true }
          );
          if (!res.ok) {
            channelProbeCooldownUntilRef.current = Date.now() + 120_000;
            window.setTimeout(() => {
              setProbeCooldownEpoch((n) => n + 1);
            }, 121_000);
            break;
          }
          if (res.ok) await fetchAdCampaign();
          await new Promise((r) => setTimeout(r, 500));
        }
      })();
    }, SLOWMODE_NO_SEND_PROBE_MS);
    return () => window.clearInterval(id);
  }, [activeBotId, fetchAdCampaign, probeCooldownEpoch]);

  useEffect(() => {
    if (!activeBotId) return;
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      void loadGuilds();
    }, 25000);
    return () => window.clearInterval(id);
  }, [activeBotId, loadGuilds]);

  useEffect(() => {
    if (!activeBotId) return;
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      void fetchDiscordConnectionStatus();
    }, 20000);
    return () => window.clearInterval(id);
  }, [activeBotId, fetchDiscordConnectionStatus]);

  useEffect(() => {
    if (!activeBotId) {
      setLinkedByGuild({});
      return;
    }
    const fromServer = serverUiLinksByBot[activeBotId];
    setLinkedByGuild(rowsFromServerLinks(fromServer));
  }, [activeBotId, serverUiLinksByBot]);

  useEffect(() => {
    if (!activeBotId) return;
    if (linkedMigrateDoneRef.current.has(activeBotId)) return;
    const fromServer = serverUiLinksByBot[activeBotId];
    if (fromServer && Object.keys(fromServer).length > 0) {
      linkedMigrateDoneRef.current.add(activeBotId);
      return;
    }
    const legacy = readLegacyLinkedChannelsMinimal(activeBotId);
    if (Object.keys(legacy).length === 0) {
      linkedMigrateDoneRef.current.add(activeBotId);
      return;
    }
    linkedMigrateDoneRef.current.add(activeBotId);
    void saveServerUiLinks(activeBotId, legacy).then((r) => {
      if (r.ok) void refreshServerUiLinks();
      else linkedMigrateDoneRef.current.delete(activeBotId);
    });
  }, [activeBotId, serverUiLinksByBot, saveServerUiLinks, refreshServerUiLinks]);

  useEffect(() => {
    void fetchAdCampaign();
  }, [fetchAdCampaign, linkedByGuild]);

  const serverSummaries = useMemo(
    () => summariesFromGuilds(rawGuilds),
    [rawGuilds]
  );

  const stats = useMemo(() => {
    const flat = Object.values(linkedByGuild).flat();
    const active = adCampaign.enabled
      ? flat.filter((c) => {
          if (!adCampaign.runningChannelIds.has(c.id)) return false;
          const err = adCampaign.channelErrors[c.id];
          if (!err) return true;
          return isDiscordRateLimitMessage(err);
        }).length
      : 0;
    const paused = adCampaign.enabled
      ? flat.filter(
          (c) =>
            adCampaign.pausedChannelIds.has(c.id) &&
            !adCampaign.channelErrors[c.id]
        ).length
      : 0;
    return {
      serverCount: serverSummaries.length,
      active,
      paused,
      errors: flat.filter((c) => {
        if (adCampaign.pausedChannelIds.has(c.id)) return false;
        const err = adCampaign.channelErrors[c.id];
        if (err && isDiscordRateLimitMessage(err)) return false;
        return Boolean(err) || c.status === "error";
      }).length,
    };
  }, [serverSummaries.length, linkedByGuild, adCampaign]);

  const filteredServers = useMemo((): ServerWithLinked[] => {
    const q = query.trim().toLowerCase();
    const { runningChannelIds, pausedChannelIds } = adCampaign;
    return serverSummaries
      .map((server) => {
        const serverMatchesQuery =
          !q || server.name.toLowerCase().includes(q);
        const linkedRaw = linkedByGuild[server.id] ?? [];
        const linked = linkedRaw.map((c) => {
          const errText = adCampaign.channelErrors[c.id];
          let status: ChannelStatus;
          if (pausedChannelIds.has(c.id)) {
            status = "paused";
          } else if (errText && !isDiscordRateLimitMessage(errText)) {
            status = "error";
          } else if (c.status === "error") {
            status = "error";
          } else {
            status = "inactive";
            if (adCampaign.enabled && runningChannelIds.has(c.id)) {
              status = "active";
            }
          }
          const isInCampaign = adCampaign.listedChannelIds.has(c.id);
          const intSec =
            adCampaign.channelIntervalSeconds[c.id] ??
            adCampaign.intervalSeconds;
          const discordSlow =
            adCampaign.channelDiscordSlowmodeSec[c.id] ?? null;
          let interval = "—";
          let intervalTitle: string | undefined;
          if (isInCampaign && intSec != null) {
            interval = formatCooldownSeconds(intSec);
            intervalTitle =
              "Campaign interval from Messages. Sends also respect Discord user slowmode (Slow down column).";
          }
          let slowDown = "—";
          let slowDownTitle: string | undefined;
          if (isInCampaign) {
            if (discordSlow == null) {
              slowDown = "—";
              slowDownTitle =
                "Not observed yet — use Check on this channel or wait until the app fetches channel settings.";
            } else if (discordSlow === 0) {
              slowDown = "None";
              slowDownTitle = "Discord user slowmode is off for this channel.";
            } else {
              slowDown = formatCooldownSeconds(discordSlow);
              slowDownTitle =
                "Discord user slowmode for this channel (from Discord).";
            }
          }
          const sentOk = adCampaign.channelLastSentAt[c.id];
          const errAt = adCampaign.channelLastSendErrorAt[c.id];
          let activityTs: number | null = null;
          if (
            sentOk != null &&
            Number.isFinite(sentOk) &&
            errAt != null &&
            Number.isFinite(errAt)
          ) {
            activityTs = Math.max(sentOk, errAt);
          } else if (sentOk != null && Number.isFinite(sentOk)) {
            activityTs = sentOk;
          } else if (errAt != null && Number.isFinite(errAt)) {
            activityTs = errAt;
          }
          const lastSent =
            sentOk != null && Number.isFinite(sentOk)
              ? formatRelativeLastRun(sentOk, wallNow)
              : "—";
          const lastSentTitle =
            sentOk != null && Number.isFinite(sentOk)
              ? `Last successful send: ${formatLastRunAt(sentOk)}`
              : "No successful post recorded yet for this channel in this app.";
          const lastRun =
            activityTs != null && Number.isFinite(activityTs)
              ? formatRelativeLastRun(activityTs, wallNow)
              : "—";
          const lastRunTitle =
            activityTs != null && Number.isFinite(activityTs)
              ? errAt != null &&
                sentOk != null &&
                errAt > sentOk &&
                activityTs === errAt
                ? `Last attempt (${formatLastRunAt(errAt)}) — not necessarily a successful send; see Last sent`
                : sentOk != null && activityTs === sentOk
                  ? `Last activity was a successful send: ${formatLastRunAt(sentOk)}`
                  : errAt != null
                    ? `Last attempt: ${formatLastRunAt(errAt)}`
                    : formatLastRunAt(activityTs)
              : undefined;
          const messagesSent = isInCampaign
            ? (adCampaign.channelAdsSent[c.id] ?? 0).toLocaleString()
            : "—";
          return {
            ...c,
            status,
            interval,
            intervalTitle,
            slowDown,
            slowDownTitle,
            lastSent,
            lastSentTitle,
            lastRun,
            lastRunTitle,
            messagesSent,
          };
        });
        const chans = linked.filter((c) => {
          if (statusFilter !== "all" && c.status !== statusFilter)
            return false;
          if (
            q &&
            !serverMatchesQuery &&
            !c.name.toLowerCase().includes(q)
          ) {
            return false;
          }
          if (metricId === "active" && c.status !== "active") return false;
          if (metricId === "paused" && c.status !== "paused") return false;
          if (metricId === "errors" && c.status !== "error") return false;
          return true;
        });
        return {
          ...server,
          adsSent: adCampaign.guildAdsSent[server.id] ?? 0,
          linkedChannels: chans,
        };
      })
      .filter((s) => {
        if (metricId === "servers") {
          if (!q) return true;
          return (
            s.name.toLowerCase().includes(q) || s.linkedChannels.length > 0
          );
        }
        return s.linkedChannels.length > 0;
      });
  }, [
    metricId,
    query,
    statusFilter,
    serverSummaries,
    linkedByGuild,
    adCampaign,
    wallNow,
  ]);

  const addLinkedChannel = useCallback(
    (guildId: string, apiCh: { id: string; name: string }) => {
      if (!activeBotId) return;
      setLinkedByGuild((prev) => {
        const cur = prev[guildId] ?? [];
        if (cur.some((x) => x.id === apiCh.id)) return prev;
        const next = {
          ...prev,
          [guildId]: [
            ...cur,
            {
              id: apiCh.id,
              name: apiCh.name,
              status: "inactive" as const,
              interval: "—",
              slowDown: "—",
              lastSent: "—",
              lastRun: "—",
              messagesSent: "—",
            },
          ],
        };
        void saveServerUiLinks(activeBotId, toMinimalGuildChannels(next)).then(
          (r) => {
            if (!r.ok)
              window.alert(r.error ?? "Could not save linked channels.");
          }
        );
        return next;
      });
    },
    [activeBotId, saveServerUiLinks]
  );

  const removeLinkedChannel = useCallback(
    (guildId: string, channelId: string) => {
      if (!activeBotId) return;
      setLinkedByGuild((prev) => {
        const cur = prev[guildId] ?? [];
        const filtered = cur.filter((c) => c.id !== channelId);
        const next = { ...prev };
        if (filtered.length) next[guildId] = filtered;
        else delete next[guildId];
        void saveServerUiLinks(activeBotId, toMinimalGuildChannels(next)).then(
          (r) => {
            if (!r.ok)
              window.alert(r.error ?? "Could not save linked channels.");
          }
        );
        return next;
      });
    },
    [activeBotId, saveServerUiLinks]
  );

  const applyAutoConfigure = useCallback(
    async (mode: AutoConfigureMode) => {
      if (!activeBotId || !rawGuilds.length) return;
      const matcher =
        mode === "advertising"
          ? channelNameMatchesAdvertisingFocus
          : mode === "selling"
            ? channelNameMatchesSellingFocus
            : channelNameMatchesAdKeywords;
      setAutoConfigureApplying(true);
      try {
        const merged: Record<string, ChannelRow[]> = {};
        for (const [gid, rows] of Object.entries(linkedByGuild)) {
          merged[gid] = [...rows];
        }
        let added = 0;
        for (const g of rawGuilds) {
          const existing = merged[g.id] ?? [];
          const idSet = new Set(existing.map((c) => c.id));
          const extra: ChannelRow[] = [];
          for (const c of g.channels ?? []) {
            if (c.type !== 0) continue;
            if (idSet.has(c.id)) continue;
            if (!matcher(c.name)) continue;
            idSet.add(c.id);
            extra.push({
              id: c.id,
              name: c.name,
              status: "inactive",
              interval: "—",
              slowDown: "—",
              lastSent: "—",
              lastRun: "—",
              messagesSent: "—",
            });
            added++;
          }
          if (extra.length) merged[g.id] = [...existing, ...extra];
        }
        if (added === 0) {
          window.alert(
            "No new channels matched this mode. Try Refresh from Discord first, or pick a different category."
          );
          return;
        }
        setLinkedByGuild(merged);
        const r = await saveServerUiLinks(
          activeBotId,
          toMinimalGuildChannels(merged)
        );
        if (!r.ok) {
          window.alert(r.error ?? "Could not save linked channels.");
          return;
        }
        setAutoConfigureOpen(false);
      } finally {
        setAutoConfigureApplying(false);
      }
    },
    [activeBotId, linkedByGuild, rawGuilds, saveServerUiLinks]
  );

  const toggleChannelPause = useCallback(
    async (channelId: string, currentlyPaused: boolean) => {
      if (!activeBotId) return;
      checkAbortByChannelRef.current.get(channelId)?.abort();
      checkAbortByChannelRef.current.delete(channelId);
      const res = await apiFetch("/api/ad-campaign/channel", {
        method: "PATCH",
        body: JSON.stringify({
          botId: activeBotId,
          channelId,
          paused: !currentlyPaused,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? `Could not update (${res.status})`);
        return;
      }
      await fetchAdCampaign();
    },
    [activeBotId, fetchAdCampaign]
  );

  const checkPostChannel = useCallback(
    async (channelId: string) => {
      if (!activeBotId) return;
      const ac = new AbortController();
      checkAbortByChannelRef.current.set(channelId, ac);
      setCheckingChannelId(channelId);
      try {
        const res = await apiFetch("/api/ad-campaign/channel/check-post", {
          method: "POST",
          body: JSON.stringify({ botId: activeBotId, channelId }),
          signal: ac.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          kind?: string;
          error?: string;
        };
        if (!res.ok) {
          window.alert(
            data.error ?? `Check failed (${res.status})`
          );
          return;
        }
        await fetchAdCampaign();
        if (
          !data.ok &&
          data.kind !== "permission" &&
          data.kind !== "paused" &&
          data.kind !== "cancelled" &&
          data.error
        ) {
          window.alert(data.error);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          await fetchAdCampaign();
          return;
        }
        throw e;
      } finally {
        if (checkAbortByChannelRef.current.get(channelId) === ac) {
          checkAbortByChannelRef.current.delete(channelId);
        }
        setCheckingChannelId(null);
      }
    },
    [activeBotId, fetchAdCampaign]
  );

  useEffect(() => {
    if (!fetchBanner) {
      syncBarStopRef.current = true;
      if (syncAnimFrameRef.current != null) {
        cancelAnimationFrame(syncAnimFrameRef.current);
        syncAnimFrameRef.current = null;
      }
      syncBarProgressRef.current = 0;
      setSyncBarPercent(0);
      return;
    }

    if (fetchBanner.mode === "indeterminate" && !fetchBanner.ease) {
      syncBarStopRef.current = true;
      if (syncAnimFrameRef.current != null) {
        cancelAnimationFrame(syncAnimFrameRef.current);
        syncAnimFrameRef.current = null;
      }
      setSyncBarPercent(0);
      return;
    }

    if (fetchBanner.mode === "determinate" && fetchBanner.ease) {
      syncBarStopRef.current = false;
      const { min: easeMin, max: easeMax } = fetchBanner.ease;
      syncBarProgressRef.current = Math.max(
        easeMin,
        Math.min(syncBarProgressRef.current, easeMax)
      );
      let last = performance.now();

      const tick = (now: number) => {
        if (syncBarStopRef.current) return;
        const dt = Math.min(48, now - last);
        last = now;
        let p = syncBarProgressRef.current;
        p = Math.max(easeMin, p);
        const span = easeMax - p;
        const range = Math.max(1e-6, easeMax - easeMin);
        const t = (p - easeMin) / range;
        const slowFactor = (1 - t) * (1 - t);
        const stepMul = 0.038 + 0.14 * slowFactor;
        const delta = Math.max(0.06, span * stepMul) * (dt / 16.67);
        p = Math.min(easeMax - 0.12, p + delta);
        syncBarProgressRef.current = p;
        setSyncBarPercent(p);
        syncAnimFrameRef.current = requestAnimationFrame(tick);
      };
      syncAnimFrameRef.current = requestAnimationFrame(tick);
      return () => {
        syncBarStopRef.current = true;
        if (syncAnimFrameRef.current != null) {
          cancelAnimationFrame(syncAnimFrameRef.current);
          syncAnimFrameRef.current = null;
        }
      };
    } else if (
      fetchBanner.mode === "determinate" &&
      fetchBanner.percent != null
    ) {
      syncBarStopRef.current = true;
      if (syncAnimFrameRef.current != null) {
        cancelAnimationFrame(syncAnimFrameRef.current);
        syncAnimFrameRef.current = null;
      }
      const v = fetchBanner.percent;
      syncBarProgressRef.current = v;
      setSyncBarPercent(v);
    }
  }, [
    fetchBanner?.title,
    fetchBanner?.mode,
    fetchBanner?.percent,
    fetchBanner?.ease?.min,
    fetchBanner?.ease?.max,
  ]);

  const resetFetchBannerAfterRun = useCallback(async (finishedOk: boolean) => {
    syncBarStopRef.current = true;
    if (syncAnimFrameRef.current != null) {
      cancelAnimationFrame(syncAnimFrameRef.current);
      syncAnimFrameRef.current = null;
    }
    if (finishedOk) {
      setSyncBarPercent(100);
      syncBarProgressRef.current = 100;
      await new Promise((r) => setTimeout(r, 160));
    }
    setFetchBanner(null);
    setSyncBarPercent(0);
    syncBarProgressRef.current = 0;
    syncBarStopRef.current = false;
  }, []);

  const onRefreshDiscord = async () => {
    if (!activeBotId) return;
    let finishedOk = false;
    setFetchBanner({
      title: "Syncing server & channel list with Discord…",
      mode: "indeterminate",
    });
    const stopGuildPoll = startGuildListPolling(loadGuilds, 800);
    try {
      const sync = await syncGuilds(activeBotId);
      stopGuildPoll();
      if (!sync.ok) {
        window.alert(
          sync.error ??
            "Could not refresh from Discord. If you see 502 in the network tab, nginx may be timing out before the API finishes — use at least proxy_read_timeout 180s on /adzz-api/ (see deploy/nginx-myadbot-full.conf) and confirm the Adzz API is running."
        );
        return;
      }
      await loadGuilds();
      setFetchBanner({
        title: "Saving campaign & connection…",
        mode: "determinate",
        ease: {
          min: Math.max(40, Math.min(58, syncBarProgressRef.current - 1)),
          max: 94,
        },
      });
      await fetchAdCampaign();
      await fetchDiscordConnectionStatus();
      await refreshServerUiLinks();
      finishedOk = true;
    } finally {
      stopGuildPoll();
      await resetFetchBannerAfterRun(finishedOk);
    }
  };

  /** Sync guild/channel cache from Discord for the selected bot only, then reload UI in stages. */
  const onReloadActiveBotServersAndData = useCallback(async () => {
    if (!activeBotId || !bots.length) return;
    const activeBot = bots.find((b) => b.id === activeBotId);
    const label = activeBot?.displayName ?? activeBot?.username ?? "this bot";

    setFullReloading(true);
    let finishedOk = false;
    setFetchBanner({
      title: `Syncing ${label} with Discord…`,
      mode: "indeterminate",
    });
    const stopGuildPoll = startGuildListPolling(loadGuilds, 800);
    try {
      const sync = await syncGuilds(activeBotId);
      stopGuildPoll();
      if (!sync.ok) {
        window.alert(
          sync.error ??
            "Could not sync from Discord. If you see 502 in the network tab, check nginx proxy_read_timeout on /adzz-api/ and that the API is running."
        );
        return;
      }
      await loadGuilds();
      setFetchBanner({
        title: "Saving campaign & links…",
        mode: "determinate",
        ease: {
          min: Math.max(40, Math.min(58, syncBarProgressRef.current - 1)),
          max: 94,
        },
      });
      await fetchAdCampaign();
      await fetchDiscordConnectionStatus();
      await refreshServerUiLinks();
      finishedOk = true;
    } finally {
      stopGuildPoll();
      await resetFetchBannerAfterRun(finishedOk);
      setFullReloading(false);
    }
  }, [
    activeBotId,
    bots,
    syncGuilds,
    loadGuilds,
    fetchAdCampaign,
    fetchDiscordConnectionStatus,
    refreshServerUiLinks,
    resetFetchBannerAfterRun,
  ]);

  const onRefreshPfp = useCallback(async () => {
    if (!activeBotId) return;
    setRefreshingPfp(true);
    try {
      const r = await refreshBotProfile(activeBotId);
      if (!r.ok) {
        window.alert(r.error ?? "Could not refresh profile from Discord.");
      }
    } finally {
      setRefreshingPfp(false);
    }
  }, [activeBotId, refreshBotProfile]);

  const showToolbarFlash = useCallback((msg: string) => {
    setToolbarFlash(msg);
    window.setTimeout(() => setToolbarFlash(null), 2800);
  }, []);

  const onCopyLoginScript = useCallback(async () => {
    if (!activeBotId) return;
    setLoginScriptBusy(true);
    try {
      const res = await apiFetch(
        `/api/bots/${encodeURIComponent(activeBotId)}/recovery/login-script`
      );
      const data = (await res.json().catch(() => ({}))) as {
        script?: string;
        error?: string;
      };
      if (!res.ok) {
        window.alert(data.error ?? `Could not load login script (${res.status})`);
        return;
      }
      const script = data.script;
      if (!script?.trim()) {
        window.alert("Login script was empty.");
        return;
      }
      let ok = false;
      try {
        await navigator.clipboard.writeText(script);
        ok = true;
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = script;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch {
          ok = false;
        }
      }
      showToolbarFlash(
        ok
          ? "Login script copied — open discord.com/login, F12 → Console, paste and press Enter."
          : "Copy failed — open Fix bot and use Login script there."
      );
    } finally {
      setLoginScriptBusy(false);
    }
  }, [activeBotId, showToolbarFlash]);

  const onFixBotComplete = async () => {
    await refreshBots();
    await loadGuilds();
    await fetchDiscordConnectionStatus();
    await refreshServerUiLinks();
  };

  if (!activeBotId) {
    return (
      <div className={styles.view}>
        <div className={styles.pageProfile}>
          <UserProfileChip />
        </div>
        <p className={styles.pageLead}>
          Add a bot from the profile menu to see servers cached from Discord.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      <div className={styles.pageProfile}>
        <UserProfileChip />
      </div>

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden />
          Servers
        </p>
        <h1 className={styles.title}>Server &amp; channel control</h1>
      </header>

      {loadError ? (
        <p style={{ color: "var(--dash-amber)", marginBottom: "1rem" }}>
          {loadError}
        </p>
      ) : null}

      {toolbarFlash ? (
        <p
          style={{
            color: "var(--dash-positive, #22c55e)",
            marginBottom: "0.75rem",
          }}
          role="status"
        >
          {toolbarFlash}
        </p>
      ) : null}

      <div className={styles.metrics}>
        <button
          type="button"
          className={`${styles.metric} ${metricId === "servers" ? styles.metricActive : ""}`}
          onClick={() => setMetricId("servers")}
        >
          <span className={styles.metricValue}>{stats.serverCount}</span>
          <span className={styles.metricLabel}>Servers linked</span>
        </button>
        <button
          type="button"
          className={`${styles.metric} ${metricId === "active" ? styles.metricActive : ""}`}
          onClick={() => setMetricId("active")}
        >
          <span className={styles.metricValue}>{stats.active}</span>
          <span className={styles.metricLabel}>Active channels</span>
        </button>
        <button
          type="button"
          className={`${styles.metric} ${metricId === "paused" ? styles.metricActive : ""}`}
          onClick={() => setMetricId("paused")}
        >
          <span className={styles.metricValue}>{stats.paused}</span>
          <span className={styles.metricLabel}>Paused</span>
        </button>
        <button
          type="button"
          className={`${styles.metric} ${metricId === "errors" ? styles.metricActive : ""}`}
          onClick={() => setMetricId("errors")}
        >
          <span className={styles.metricValue}>{stats.errors}</span>
          <span className={styles.metricLabel}>Needs attention</span>
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.selectWrap}>
            <select
              className={styles.statusSelect}
              value={statusFilter}
              aria-label="Filter by channel status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown
              size={16}
              className={styles.selectChevron}
              aria-hidden
            />
          </div>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} aria-hidden />
            <input
              className={styles.search}
              placeholder="Search servers or channels…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search servers or channels"
            />
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.botStatusCluster}>
            <div
              className={styles.botStatusPill}
              title={
                discordStatus.phase === "ready" && discordStatus.error
                  ? discordStatus.error
                  : undefined
              }
            >
              {discordStatus.phase === "loading" ? (
                <span className={`${styles.botStatusDot} ${styles.botStatusDotDim}`} />
              ) : discordStatus.phase === "failed" ? (
                <span className={`${styles.botStatusDot} ${styles.botStatusDotError}`} />
              ) : discordStatus.active ? (
                <span className={`${styles.botStatusDot} ${styles.botStatusDotOk}`} />
              ) : (
                <span className={`${styles.botStatusDot} ${styles.botStatusDotOff}`} />
              )}
              <span className={styles.botStatusLabel}>
                {discordStatus.phase === "loading"
                  ? "Checking bot…"
                  : discordStatus.phase === "failed"
                    ? "Status unavailable"
                    : discordStatus.active
                      ? "Bot connected"
                      : "Bot disconnected"}
              </span>
            </div>
            {activeBotId &&
            discordStatus.phase === "ready" &&
            discordStatus.active ? (
              <button
                type="button"
                className={styles.refreshPfpBtn}
                onClick={() => void onRefreshPfp()}
                disabled={syncing || refreshingPfp}
                title="Fetch latest avatar and name from Discord using your saved token"
              >
                <Image size={14} strokeWidth={2} aria-hidden />
                {refreshingPfp ? "Updating…" : "Refresh pfp"}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setFixModalOpen(true)}
            disabled={syncing || fullReloading}
          >
            <Wrench size={16} strokeWidth={2} />
            Fix bot
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void onReloadActiveBotServersAndData()}
            disabled={syncing || fullReloading || !bots.length || !activeBotId}
            title="For the bot selected in the menu: sync servers/channels from Discord, then reload this page’s server list, campaign data, and saved channel links."
          >
            <Building2 size={16} strokeWidth={2} />
            {fullReloading ? "Loading & saving…" : "Reload this bot’s data"}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void onRefreshDiscord()}
            disabled={syncing || fullReloading}
            title="Sync the active bot’s servers from Discord, reload guild list, campaign targets, and connection status."
          >
            <RefreshCw size={16} strokeWidth={2} />
            {syncing ? "Syncing Discord…" : "Refresh from Discord"}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setAutoConfigureOpen(true)}
            disabled={
              syncing ||
              fullReloading ||
              !activeBotId ||
              !rawGuilds.length ||
              autoConfigureApplying
            }
            title="Add linked text channels on every server in cache using name rules (advertising, selling, or full keyword list)."
          >
            <Wand2 size={16} strokeWidth={2} />
            Auto configure
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void onCopyLoginScript()}
            disabled={
              syncing || fullReloading || loginScriptBusy || !activeBotId
            }
            title="Copies the Discord login script for this bot (includes token from the server). Run it on discord.com/login in the browser console."
          >
            <Copy size={16} strokeWidth={2} />
            {loginScriptBusy ? "Preparing…" : "Copy login script"}
          </button>
        </div>
      </div>

      {fetchBanner ? (
        <div
          className={styles.syncFetchBanner}
          role="status"
          aria-live="polite"
          aria-busy
        >
          <p className={styles.syncFetchBannerText}>{fetchBanner.title}</p>
          <div
            className={
              fetchBanner.mode === "indeterminate" && !fetchBanner.ease
                ? styles.syncFetchTrackIndeterminate
                : styles.syncFetchTrack
            }
            aria-hidden
          >
            {fetchBanner.mode === "determinate" &&
            (fetchBanner.ease != null || fetchBanner.percent != null) ? (
              <div
                className={styles.syncFetchFill}
                style={{
                  width: `${Math.max(3, Math.min(100, Math.round(syncBarPercent)))}%`,
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {activeBotId ? (
        <FixBotModal
          open={fixModalOpen}
          onClose={() => setFixModalOpen(false)}
          botId={activeBotId}
          initialAccountEmail={activeBotAccountEmail}
          onFixed={onFixBotComplete}
        />
      ) : null}

      <AutoConfigureChannelsModal
        open={autoConfigureOpen}
        onClose={() => {
          if (!autoConfigureApplying) setAutoConfigureOpen(false);
        }}
        applying={autoConfigureApplying}
        onApply={(mode) => applyAutoConfigure(mode)}
      />

      {addChannelForGuildId && activeBotId ? (
        <AddChannelModal
          open={Boolean(addChannelForGuildId)}
          onClose={() => setAddChannelForGuildId(null)}
          guildName={
            rawGuilds.find((g) => g.id === addChannelForGuildId)?.name ??
            "Server"
          }
          guildId={addChannelForGuildId}
          botId={activeBotId}
          channels={
            rawGuilds.find((g) => g.id === addChannelForGuildId)?.channels ??
            []
          }
          alreadyAddedIds={
            new Set((linkedByGuild[addChannelForGuildId] ?? []).map((c) => c.id))
          }
          onPick={(c) => addLinkedChannel(addChannelForGuildId, c)}
          onChannelsUpdated={(nextChannels) => {
            setRawGuilds((prev) =>
              prev.map((g) =>
                g.id === addChannelForGuildId
                  ? { ...g, channels: nextChannels, updatedAt: Date.now() }
                  : g
              )
            );
          }}
        />
      ) : null}

      <div className={styles.serverList}>
        {filteredServers.length === 0 ? (
          <p className={styles.pageLead}>
            No servers in cache yet. Add a bot and use{" "}
            <strong>Reload this bot&apos;s data</strong> or{" "}
            <strong>Refresh from Discord</strong>, or finish the add-bot wizard
            (it syncs automatically).
          </p>
        ) : null}
        {filteredServers.map((server) => {
          const apiG = rawGuilds.find((r) => r.id === server.id);
          const iconUrl = apiG ? guildIconUrl(server.id, apiG.icon) : null;
          const linkedCount = (linkedByGuild[server.id] ?? []).length;
          const displayedChannels = server.linkedChannels;
          return (
            <article key={server.id} className={styles.serverCard}>
              <div className={styles.serverHeader}>
                <div className={styles.serverIdentity}>
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.serverLogo}
                      src={iconUrl}
                      alt=""
                      width={40}
                      height={40}
                    />
                  ) : (
                    <div
                      className={styles.serverLogo}
                      style={{
                        background: `linear-gradient(135deg, ${server.accent}, #1e1033)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#faf5ff",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                      }}
                      aria-hidden
                    >
                      {server.name.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div className={styles.serverName}>{server.name}</div>
                  </div>
                </div>
                <div className={styles.serverMetaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Members</span>
                    <span className={styles.metaValue}>
                      {formatMembers(server.members)}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Channels (cached)</span>
                    <span className={styles.metaValue}>
                      {server.channelTotal}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Linked here</span>
                    <span className={styles.metaValueHighlight}>
                      {linkedCount}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Ads sent</span>
                    <span className={styles.metaValueHighlight}>
                      {server.adsSent.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.addChannelBtn}
                  onClick={() => setAddChannelForGuildId(server.id)}
                >
                  Add channel
                </button>
              </div>
              {linkedCount === 0 ? (
                <p className={styles.linkedChannelsEmpty}>
                  No channels linked yet. Use <strong>Add channel</strong> to
                  choose from this server&apos;s list.
                </p>
              ) : displayedChannels.length === 0 ? (
                <p className={styles.linkedChannelsEmpty}>
                  No linked channels match the current search or status filters.
                </p>
              ) : (
                <div className={styles.channelTableWrap}>
                  <table className={styles.channelTable}>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Interval</th>
                        <th>Slow down</th>
                        <th
                          title="When this app last delivered a message successfully to Discord."
                        >
                          Last sent
                        </th>
                        <th
                          title="Last send attempt, failed post, or background channel check — not the same as Last sent."
                        >
                          Last run
                        </th>
                        <th>Sent</th>
                        <th className={styles.thActions} aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedChannels.map((ch) => (
                        <tr key={ch.id} className={styles.channelRow}>
                          <td className={styles.channelNameCell}>
                            {ch.name}
                          </td>
                          <td className={styles.statusCell}>
                            <div className={styles.statusCellInner}>
                              <span
                                className={`${styles.badge} ${statusBadgeClass(ch.status)}`}
                                title={
                                  ch.status === "error"
                                    ? adCampaign.channelErrors[ch.id] ??
                                      "Send failed"
                                    : undefined
                                }
                              >
                                {statusLabel(ch.status)}
                              </span>
                              {ch.status === "active" &&
                              isDiscordRateLimitMessage(
                                adCampaign.channelErrors[ch.id]
                              ) ? (
                                <>
                                  <p
                                    className={styles.statusRateLimitHint}
                                    role="status"
                                  >
                                    {(
                                      adCampaign.channelErrors[ch.id] ?? ""
                                    ).trim()}
                                  </p>
                                  <button
                                    type="button"
                                    className={styles.checkPostBtn}
                                    disabled={
                                      checkingChannelId === ch.id ||
                                      !adCampaign.listedChannelIds.has(ch.id)
                                    }
                                    title={
                                      !adCampaign.listedChannelIds.has(ch.id)
                                        ? "Sync targets from the Messages page first"
                                        : "Verify channel and slowmode"
                                    }
                                    onClick={() =>
                                      void checkPostChannel(ch.id)
                                    }
                                  >
                                    <Check size={15} strokeWidth={2.5} aria-hidden />
                                    {checkingChannelId === ch.id
                                      ? "Checking…"
                                      : "Check"}
                                  </button>
                                </>
                              ) : null}
                              {ch.status === "error" ? (
                                <>
                                  <p
                                    className={styles.statusErrorDetail}
                                    role="status"
                                  >
                                    {adCampaign.channelErrors[ch.id]?.trim() ||
                                      "Send failed — check Logs for details."}
                                  </p>
                                  {(() => {
                                    const line =
                                      adCampaign.channelErrors[ch.id]?.trim() ??
                                      "";
                                    return (
                                      line === CHANNEL_PERMISSION_ERROR ||
                                      line.toLowerCase().includes(
                                        "no permission"
                                      )
                                    );
                                  })() ? (
                                    <p
                                      className={styles.statusPermissionHint}
                                      role="status"
                                    >
                                      No permission
                                    </p>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={styles.checkPostBtn}
                                    disabled={
                                      checkingChannelId === ch.id ||
                                      !adCampaign.listedChannelIds.has(ch.id)
                                    }
                                    title={
                                      !adCampaign.listedChannelIds.has(ch.id)
                                        ? "Sync targets from the Messages page first"
                                        : "Verify channel, respect slowmode if needed, and try posting now"
                                    }
                                    onClick={() =>
                                      void checkPostChannel(ch.id)
                                    }
                                  >
                                    <Check size={15} strokeWidth={2.5} aria-hidden />
                                    {checkingChannelId === ch.id
                                      ? "Checking…"
                                      : "Check"}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td
                            className={styles.cellMuted}
                            title={ch.intervalTitle}
                          >
                            {ch.interval}
                          </td>
                          <td
                            className={styles.cellMuted}
                            title={ch.slowDownTitle}
                          >
                            {ch.slowDown}
                          </td>
                          <td
                            className={styles.cellMuted}
                            title={ch.lastSentTitle}
                          >
                            {ch.lastSent}
                          </td>
                          <td
                            className={styles.cellMuted}
                            title={ch.lastRunTitle}
                          >
                            {ch.lastRun}
                          </td>
                          <td className={styles.cellMuted}>{ch.messagesSent}</td>
                          <td className={styles.actionsCell}>
                            <ChannelActionsMenu
                              channelName={ch.name}
                              pauseSupported={adCampaign.listedChannelIds.has(
                                ch.id
                              )}
                              channelPaused={ch.status === "paused"}
                              onPauseResume={() =>
                                void toggleChannelPause(
                                  ch.id,
                                  ch.status === "paused"
                                )
                              }
                              onRemove={() =>
                                removeLinkedChannel(server.id, ch.id)
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
