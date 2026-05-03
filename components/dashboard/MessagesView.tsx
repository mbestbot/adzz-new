"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { discordAvatarUrl, discordDefaultAvatarUrl } from "@/lib/discordAvatar";
import { useAuth } from "@/components/auth/AuthContext";
import {
  useBots,
  type BotSummary,
  type ServerUiLinksByBot,
} from "@/components/dashboard/BotContext";
import styles from "./messages.module.css";

const DEFAULT_MESSAGE = `**Your headline here**

Short value prop — what you offer and why it matters.

> Optional callout or quote block.

---

**CTA:** Link or next step for readers.`;

const INTERVAL_OPTIONS = [
  "5 Second(s)",
  "5 Minute(s)",
  "30 Minute(s)",
  "1 Hour(s)",
  "2 Hour(s)",
  "6 Hour(s)",
  "12 Hour(s)",
  "24 Hour(s)",
];

type ApiTarget = {
  botId: string;
  guildId?: string;
  channelId: string;
  paused?: boolean;
};

type ApiCampaignRow = {
  id: string;
  title?: string;
  enabled?: boolean;
  message?: string;
  intervalLabel?: string | null;
  intervalMs?: number;
  sendPeriod?: boolean;
  targets?: ApiTarget[];
  lastSendError?: string | null;
};

type MessagesTab = "basic" | "campaign" | "adpool";

type ApiMessagesState = {
  uiMode: "basic" | "adpool";
  burst: {
    botId: string;
    message: string;
    quotaTotal: number;
    quotaSent: number;
    intervalLabel: string;
    intervalMs: number;
    targets?: ApiTarget[];
  } | null;
  adPool: {
    messages: string[];
    rotationIndex: number;
    intervalLabel: string;
    intervalMs: number;
    targets?: ApiTarget[];
  } | null;
};

type AdPoolLocal = {
  messages: string[];
  allBotsSelected: boolean;
  selectedBotIds: string[];
  allServersSelected: boolean;
  selectedServerIds: string[];
  interval: string;
  serversCollapsed: boolean;
};

type LocalCampaign = {
  id: string;
  title: string;
  message: string;
  allBotsSelected: boolean;
  selectedBotIds: string[];
  allServersSelected: boolean;
  selectedServerIds: string[];
  interval: string;
  sendPeriod: boolean;
  inactivityTimeout: boolean;
  serversCollapsed: boolean;
  cardCollapsed: boolean;
  lastSendError: string | null;
};

function hydrateCampaignFromApi(
  api: ApiCampaignRow,
  bots: BotSummary[]
): LocalCampaign {
  const targets = api.targets ?? [];
  if (targets.length === 0) {
    const label = api.intervalLabel ?? "1 Hour(s)";
    return {
      id: api.id,
      title: (api.title ?? "").trim() || "Campaign",
      message:
        typeof api.message === "string" && api.message.trim()
          ? api.message
          : DEFAULT_MESSAGE,
      allBotsSelected: true,
      selectedBotIds: [],
      allServersSelected: true,
      selectedServerIds: [],
      interval: INTERVAL_OPTIONS.includes(label) ? label : "1 Hour(s)",
      sendPeriod: Boolean(api.sendPeriod),
      inactivityTimeout: false,
      serversCollapsed: true,
      cardCollapsed: false,
      lastSendError: api.lastSendError ?? null,
    };
  }
  const botIdSet = new Set(targets.map((t) => t.botId));
  const allBots =
    bots.length > 0 &&
    botIdSet.size === bots.length &&
    bots.every((b) => botIdSet.has(b.id));
  const guildIdSet = new Set(
    targets
      .map((t) => String(t.guildId ?? "").trim())
      .filter(Boolean)
  );
  const label = api.intervalLabel ?? "1 Hour(s)";
  return {
    id: api.id,
    title: (api.title ?? "").trim() || "Campaign",
    message:
      typeof api.message === "string" && api.message.trim()
        ? api.message
        : DEFAULT_MESSAGE,
    allBotsSelected: allBots,
    selectedBotIds: allBots ? [] : [...botIdSet],
    allServersSelected: false,
    selectedServerIds: [...guildIdSet],
    interval: INTERVAL_OPTIONS.includes(label) ? label : "1 Hour(s)",
    sendPeriod: Boolean(api.sendPeriod),
    inactivityTimeout: false,
    serversCollapsed: true,
    cardCollapsed: false,
    lastSendError: api.lastSendError ?? null,
  };
}

function hydrateAdPoolFromApi(
  api: NonNullable<ApiMessagesState["adPool"]>,
  bots: BotSummary[]
): AdPoolLocal {
  const targets = api.targets ?? [];
  const label = api.intervalLabel ?? "1 Hour(s)";
  const messages =
    Array.isArray(api.messages) && api.messages.length > 0
      ? api.messages.map((m) => String(m ?? ""))
      : [DEFAULT_MESSAGE];
  if (targets.length === 0) {
    return {
      messages,
      allBotsSelected: true,
      selectedBotIds: [],
      allServersSelected: true,
      selectedServerIds: [],
      interval: INTERVAL_OPTIONS.includes(label) ? label : "1 Hour(s)",
      serversCollapsed: true,
    };
  }
  const botIdSet = new Set(targets.map((t) => t.botId));
  const allBots =
    bots.length > 0 &&
    botIdSet.size === bots.length &&
    bots.every((b) => botIdSet.has(b.id));
  const guildIdSet = new Set(
    targets
      .map((t) => String(t.guildId ?? "").trim())
      .filter(Boolean)
  );
  return {
    messages,
    allBotsSelected: allBots,
    selectedBotIds: allBots ? [] : [...botIdSet],
    allServersSelected: false,
    selectedServerIds: [...guildIdSet],
    interval: INTERVAL_OPTIONS.includes(label) ? label : "1 Hour(s)",
    serversCollapsed: true,
  };
}

function buildAdTargets(
  effectiveBotIds: string[],
  serverIds: Set<string>,
  linksByBot: ServerUiLinksByBot
): { botId: string; guildId: string; channelId: string }[] {
  const out: { botId: string; guildId: string; channelId: string }[] = [];
  for (const botId of effectiveBotIds) {
    const linked = linksByBot[botId] ?? {};
    for (const [guildId, channels] of Object.entries(linked)) {
      if (!serverIds.has(guildId)) continue;
      for (const ch of channels) {
        out.push({ botId, guildId, channelId: ch.id });
      }
    }
  }
  return out;
}

type ApiGuild = {
  id: string;
  name: string;
  icon: string | null;
  approximateMemberCount: number;
  channels: unknown[];
  updatedAt: number;
};

function isBotAccount(bot: BotSummary): boolean {
  return String(bot.tokenType).toLowerCase() === "bot";
}

function formatDiscordTimestamp(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (isToday) return `Today at ${time}`;
  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + ` at ${time}`
  );
}

function parseInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function PreviewLine({ line, index }: { line: string; index: number }) {
  const raw = line.trimEnd();
  const trimmed = raw.trim();

  if (!trimmed) {
    return <div key={index} className={styles.discordBlankLine} />;
  }

  if (/^#{1,3}\s/.test(trimmed)) {
    const level = trimmed.match(/^#+/)?.[0].length ?? 1;
    const content = trimmed.replace(/^#{1,3}\s*/, "");
    const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
    const hc =
      level === 1
        ? styles.discordH1
        : level === 2
          ? styles.discordH2
          : styles.discordH3;
    return (
      <Tag key={index} className={hc}>
        {parseInlineBold(content)}
      </Tag>
    );
  }

  if (trimmed.startsWith(">")) {
    const inner = trimmed.replace(/^>\s?/, "");
    return (
      <blockquote key={index} className={styles.discordBlockquote}>
        {parseInlineBold(inner)}
      </blockquote>
    );
  }

  if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
    return <hr key={index} className={styles.discordDivider} />;
  }

  return (
    <p key={index} className={styles.discordParagraph}>
      {parseInlineBold(raw)}
    </p>
  );
}

function DiscordMessageLivePreview({
  text,
  bot,
}: {
  text: string;
  bot: BotSummary | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const displayName = bot?.displayName ?? "Bot";
  const showBotTag = bot ? isBotAccount(bot) : true;
  const avatarSrc = bot ? discordAvatarUrl(bot, 80) : discordDefaultAvatarUrl("0");

  const timestamp = useMemo(() => formatDiscordTimestamp(new Date()), []);

  const lines = text.split("\n");

  return (
    <div className={styles.discordShell}>
      <div className={styles.discordChannelBar}>
        <span className={styles.discordChannelHash}>#</span>
        <span className={styles.discordChannelName}>live-preview</span>
      </div>
      <div className={styles.discordMessageScroller}>
        <div className={styles.discordMessagePad}>
          <div className={styles.discordMessageRow}>
            {mounted ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                className={styles.discordAvatar}
                width={40}
                height={40}
              />
            ) : (
              <div className={styles.discordAvatar} aria-hidden />
            )}
            <div className={styles.discordMessageBody}>
              <div className={styles.discordMessageMeta}>
                <span className={styles.discordUsername}>{displayName}</span>
                {showBotTag ? (
                  <span className={styles.discordBotBadge}>BOT</span>
                ) : null}
                <time
                  className={styles.discordMetaTime}
                  dateTime={new Date().toISOString()}
                >
                  {timestamp}
                </time>
              </div>
              <div className={styles.discordMarkup}>
                {lines.map((line, i) => (
                  <PreviewLine key={i} line={line} index={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ToggleRowProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

function MasterToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: ToggleRowProps) {
  return (
    <div className={styles.masterToggle}>
      <div>
        <label className={styles.masterToggleLabel} htmlFor={id}>
          {label}
        </label>
        <p className={styles.masterToggleDesc}>{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );
}

function effectiveBots(c: LocalCampaign, bots: BotSummary[]) {
  if (!bots.length) return [];
  if (c.allBotsSelected) return bots.map((b) => b.id);
  return c.selectedBotIds;
}

function mergedServersForBotIds(
  botIds: string[],
  guildsByBot: Record<string, ApiGuild[]>
) {
  const map = new Map<string, { id: string; name: string; icon: string | null }>();
  for (const botId of botIds) {
    for (const g of guildsByBot[botId] ?? []) {
      if (!map.has(g.id)) {
        map.set(g.id, { id: g.id, name: g.name, icon: g.icon });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function effectiveServerIdsForCampaign(
  c: LocalCampaign,
  mergedServers: { id: string }[]
) {
  if (!mergedServers.length) return [];
  if (c.allServersSelected) return mergedServers.map((s) => s.id);
  return c.selectedServerIds;
}

function effectivePoolBots(p: AdPoolLocal, bots: BotSummary[]): string[] {
  if (!bots.length) return [];
  if (p.allBotsSelected) return bots.map((b) => b.id);
  return p.selectedBotIds;
}

function effectivePoolServers(
  p: AdPoolLocal,
  mergedServers: { id: string }[]
): string[] {
  if (!mergedServers.length) return [];
  if (p.allServersSelected) return mergedServers.map((s) => s.id);
  return p.selectedServerIds;
}

function buildBurstTargetsForBot(botId: string, linksByBot: ServerUiLinksByBot) {
  const linked = linksByBot[botId] ?? {};
  const guildIds = new Set(Object.keys(linked));
  return buildAdTargets([botId], guildIds, linksByBot);
}

function sameOrderedStrings(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function MessagesView() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { bots, serverUiLinksByBot } = useBots();
  const botsRef = useRef(bots);
  botsRef.current = bots;
  const serverUiLinksRef = useRef(serverUiLinksByBot);
  serverUiLinksRef.current = serverUiLinksByBot;

  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([]);
  const campaignsRef = useRef(campaigns);
  campaignsRef.current = campaigns;
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(
    null
  );
  const [campaignsHydrated, setCampaignsHydrated] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [linkedTargetsEpoch, setLinkedTargetsEpoch] = useState(0);

  const [messagesTab, setMessagesTab] = useState<MessagesTab>("basic");
  const [messagesState, setMessagesState] = useState<ApiMessagesState | null>(
    null
  );
  const [burstBotId, setBurstBotId] = useState("");
  const [burstMessage, setBurstMessage] = useState(DEFAULT_MESSAGE);
  const [burstQuota, setBurstQuota] = useState(10);
  const [burstInterval, setBurstInterval] = useState("1 Hour(s)");
  const [burstBusy, setBurstBusy] = useState(false);

  const [subscriptionTier, setSubscriptionTier] = useState<
    "none" | "pro" | "business" | null
  >(null);

  const [adPoolDraft, setAdPoolDraft] = useState<AdPoolLocal>(() => ({
    messages: [DEFAULT_MESSAGE, "", ""],
    allBotsSelected: true,
    selectedBotIds: [],
    allServersSelected: true,
    selectedServerIds: [],
    interval: "1 Hour(s)",
    serversCollapsed: true,
  }));
  const adPoolHydratedRef = useRef(false);

  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!user?.id) {
      setSubscriptionTier(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await apiFetch("/api/subscription");
      if (cancelled) return;
      if (!res.ok) {
        setSubscriptionTier("none");
        return;
      }
      const j = (await res.json()) as { tier?: string };
      const t = String(j.tier ?? "").toLowerCase();
      setSubscriptionTier(
        t === "business" || t === "pro" ? (t as "business" | "pro") : "none"
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, messagesTab]);

  const unionBotIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of campaigns) {
      for (const id of effectiveBots(c, bots)) s.add(id);
    }
    if (messagesTab === "adpool") {
      for (const id of effectivePoolBots(adPoolDraft, bots)) s.add(id);
    }
    return [...s].sort();
  }, [campaigns, bots, messagesTab, adPoolDraft]);

  const guildFetchKey = useMemo(() => unionBotIds.join(","), [unionBotIds]);

  const [guildsByBot, setGuildsByBot] = useState<Record<string, ApiGuild[]>>(
    {}
  );
  const guildsByBotRef = useRef(guildsByBot);
  guildsByBotRef.current = guildsByBot;

  const adPoolMergedServers = useMemo(() => {
    const botIds = effectivePoolBots(adPoolDraft, bots);
    return mergedServersForBotIds(botIds, guildsByBot);
  }, [adPoolDraft, bots, guildsByBot]);

  useEffect(() => {
    if (!guildFetchKey) {
      setGuildsByBot({});
      return;
    }
    let cancelled = false;
    const ids = guildFetchKey.split(",").filter(Boolean);
    (async () => {
      const next: Record<string, ApiGuild[]> = {};
      await Promise.all(
        ids.map(async (botId) => {
          const res = await apiFetch(`/api/bots/${botId}/guilds`);
          if (!res.ok) {
            next[botId] = [];
            return;
          }
          const data = (await res.json()) as { guilds: ApiGuild[] };
          next[botId] = data.guilds ?? [];
        })
      );
      if (!cancelled) setGuildsByBot(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [guildFetchKey]);

  const mergedServersByCampaignId = useMemo(() => {
    const m = new Map<string, { id: string; name: string; icon: string | null }[]>();
    for (const c of campaigns) {
      const botIds = effectiveBots(c, bots);
      m.set(c.id, mergedServersForBotIds(botIds, guildsByBot));
    }
    return m;
  }, [campaigns, bots, guildsByBot]);

  useEffect(() => {
    setCampaigns((prev) => {
      const next = prev.map((c) => {
        const merged = mergedServersByCampaignId.get(c.id) ?? [];
        if (merged.length === 0) return c;
        if (c.allServersSelected) {
          if (c.selectedServerIds.length === 0) return c;
          return { ...c, selectedServerIds: [] };
        }
        const valid = new Set(merged.map((s) => s.id));
        const sel = c.selectedServerIds.filter((id) => valid.has(id));
        const gidSet = new Set(sel);
        const allSrv =
          gidSet.size === merged.length && merged.every((s) => gidSet.has(s.id));
        const nextSel = allSrv ? [] : sel;
        if (
          c.allServersSelected === allSrv &&
          sameOrderedStrings(c.selectedServerIds, nextSel)
        ) {
          return c;
        }
        return {
          ...c,
          selectedServerIds: nextSel,
          allServersSelected: allSrv,
        };
      });
      return next.every((c, i) => c === prev[i]) ? prev : next;
    });
  }, [mergedServersByCampaignId]);

  useEffect(() => {
    const valid = new Set(bots.map((b) => b.id));
    setCampaigns((prev) => {
      const next = prev.map((c) => {
        const filtered = c.selectedBotIds.filter((id) => valid.has(id));
        if (sameOrderedStrings(c.selectedBotIds, filtered)) return c;
        return { ...c, selectedBotIds: filtered };
      });
      return next.every((c, i) => c === prev[i]) ? prev : next;
    });
  }, [bots]);

  useEffect(() => {
    if (pathname === "/messages") {
      setLinkedTargetsEpoch((n) => n + 1);
    }
  }, [pathname]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setLinkedTargetsEpoch((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCampaignsHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/ad-campaign");
      if (cancelled) return;
      if (!res.ok) {
        setCampaignsHydrated(true);
        return;
      }
      const data = (await res.json()) as { campaigns?: ApiCampaignRow[] };
      const b = botsRef.current;
      const list = (data.campaigns ?? []).map((row) =>
        hydrateCampaignFromApi(row, b)
      );
      if (!cancelled) {
        setCampaigns(list);
        setPreviewCampaignId((p) => p ?? list[0]?.id ?? null);
        setCampaignsHydrated(true);
        skipNextSave.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const savePayloadSig = useMemo(() => {
    return campaigns
      .map((c) => {
        const merged = mergedServersByCampaignId.get(c.id) ?? [];
        const eBots = effectiveBots(c, bots);
        const eSrv = new Set(effectiveServerIdsForCampaign(c, merged));
        const n = buildAdTargets(eBots, eSrv, serverUiLinksByBot).length;
        return [
          c.id,
          c.title,
          c.message,
          c.interval,
          c.sendPeriod ? 1 : 0,
          [...eBots].sort().join(","),
          [...eSrv].sort().join(","),
          n,
          linkedTargetsEpoch,
          unionBotIds.every((id) => id in guildsByBot) ? "1" : "0",
        ].join("\t");
      })
      .join("|");
  }, [
    campaigns,
    mergedServersByCampaignId,
    bots,
    linkedTargetsEpoch,
    guildsByBot,
    unionBotIds,
    serverUiLinksByBot,
  ]);

  const mergedRef = useRef(mergedServersByCampaignId);
  mergedRef.current = mergedServersByCampaignId;

  useEffect(() => {
    if (!user?.id || !campaignsHydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = window.setTimeout(async () => {
      const list = campaignsRef.current;
      const mergedMap = mergedRef.current;
      const gb = guildsByBotRef.current;

      /* Do not PUT until guild cache exists for each bot — otherwise merged
       * servers are empty, targets become [], and the API wipes posting stats. */
      for (const camp of list) {
        for (const bid of effectiveBots(camp, botsRef.current)) {
          if (!(bid in gb)) return;
        }
      }

      setGlobalError(null);
      const results = await Promise.all(
        list.map(async (c) => {
          const merged = mergedMap.get(c.id) ?? [];
          const targets = buildAdTargets(
            effectiveBots(c, botsRef.current),
            new Set(effectiveServerIdsForCampaign(c, merged)),
            serverUiLinksRef.current
          );
          const allowEmptyTargets =
            targets.length === 0 &&
            merged.length > 0 &&
            !c.allServersSelected &&
            c.selectedServerIds.length === 0;
          const res = await apiFetch("/api/ad-campaign", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId: c.id,
              enabled: true,
              message: c.message,
              interval: c.interval,
              sendPeriod: c.sendPeriod,
              title: c.title,
              targets,
              allowEmptyTargets,
            }),
          });
          return { id: c.id, ok: res.ok, res };
        })
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = (await failed.res.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg = data.error ?? `Save failed (${failed.res.status})`;
        setGlobalError(msg);
        setCampaigns((prev) =>
          prev.map((x) =>
            x.id === failed.id ? { ...x, lastSendError: msg } : x
          )
        );
      } else {
        setCampaigns((prev) =>
          prev.map((x) => ({ ...x, lastSendError: null }))
        );
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [savePayloadSig, user?.id, campaignsHydrated]);

  const previewCampaign =
    campaigns.find((c) => c.id === previewCampaignId) ?? campaigns[0] ?? null;

  const previewBot = useMemo(() => {
    if (!previewCampaign || !bots.length) return null;
    const e = effectiveBots(previewCampaign, bots);
    if (!e.length) return null;
    return bots.find((b) => b.id === e[0]) ?? null;
  }, [previewCampaign, bots]);

  const addCampaign = useCallback(async () => {
    setGlobalError(null);
    const res = await apiFetch("/api/ad-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Campaign ${campaignsRef.current.length + 1}`,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setGlobalError(data.error ?? `Could not add campaign (${res.status})`);
      return;
    }
    const j = (await res.json()) as { campaign?: ApiCampaignRow };
    if (j.campaign) {
      const nc = hydrateCampaignFromApi(j.campaign, botsRef.current);
      setCampaigns((prev) => [...prev, nc]);
      setPreviewCampaignId(nc.id);
    }
  }, []);

  const deleteCampaign = useCallback(async (id: string) => {
    if (!window.confirm("Delete this campaign? This cannot be undone.")) {
      return;
    }
    setGlobalError(null);
    const res = await apiFetch(`/api/ad-campaign/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setGlobalError(data.error ?? `Delete failed (${res.status})`);
      return;
    }
    const next = campaignsRef.current.filter((c) => c.id !== id);
    setCampaigns(next);
    setPreviewCampaignId((p) => {
      if (p !== id) return p ?? next[0]?.id ?? null;
      return next[0]?.id ?? null;
    });
    skipNextSave.current = true;
  }, []);

  const updateCampaign = useCallback((id: string, patch: Partial<LocalCampaign>) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }, []);

  const resetCampaign = useCallback((id: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              message: DEFAULT_MESSAGE,
              allBotsSelected: true,
              selectedBotIds: [],
              allServersSelected: true,
              selectedServerIds: [],
              interval: "1 Hour(s)",
              sendPeriod: true,
              inactivityTimeout: false,
            }
          : c
      )
    );
  }, []);

  const refreshMessagesState = useCallback(async () => {
    const res = await apiFetch("/api/messages-state");
    if (!res.ok) return;
    const data = (await res.json()) as ApiMessagesState;
    setMessagesState(data);
    if (!adPoolHydratedRef.current && data.adPool) {
      setAdPoolDraft(hydrateAdPoolFromApi(data.adPool, botsRef.current));
      adPoolHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    void refreshMessagesState();
    const id = window.setInterval(() => void refreshMessagesState(), 4000);
    return () => window.clearInterval(id);
  }, [refreshMessagesState]);

  useEffect(() => {
    if (bots.length && !burstBotId) setBurstBotId(bots[0].id);
  }, [bots, burstBotId]);

  const selectTab = useCallback(
    async (tab: MessagesTab) => {
      setMessagesTab(tab);
      if (tab === "adpool") {
        await apiFetch("/api/messages-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uiMode: "adpool" }),
        });
        void refreshMessagesState();
      } else if (tab === "basic") {
        await apiFetch("/api/messages-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uiMode: "basic" }),
        });
        void refreshMessagesState();
      }
    },
    [refreshMessagesState]
  );

  const startBurstCampaign = useCallback(async () => {
    setBurstBusy(true);
    setGlobalError(null);
    try {
      const targets = buildBurstTargetsForBot(burstBotId, serverUiLinksByBot);
      if (!targets.length) {
        setGlobalError(
          "No linked channels for this bot. Link channels on the Servers page first."
        );
        return;
      }
      const res = await apiFetch("/api/burst-campaign/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: burstBotId,
          message: burstMessage,
          quotaTotal: burstQuota,
          intervalLabel: burstInterval,
          targets,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGlobalError(data.error ?? `Could not start (${res.status})`);
        return;
      }
      await refreshMessagesState();
    } finally {
      setBurstBusy(false);
    }
  }, [
    burstBotId,
    burstInterval,
    burstMessage,
    burstQuota,
    refreshMessagesState,
    serverUiLinksByBot,
  ]);

  const stopBurstCampaign = useCallback(async () => {
    setBurstBusy(true);
    setGlobalError(null);
    try {
      const res = await apiFetch("/api/burst-campaign/stop", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGlobalError(data.error ?? `Could not stop (${res.status})`);
        return;
      }
      await refreshMessagesState();
    } finally {
      setBurstBusy(false);
    }
  }, [refreshMessagesState]);

  const adPoolSaveSig = useMemo(() => {
    const eBots = effectivePoolBots(adPoolDraft, bots);
    const eSrv = new Set(
      effectivePoolServers(adPoolDraft, adPoolMergedServers)
    );
    const n = buildAdTargets(eBots, eSrv, serverUiLinksByBot).length;
    return [
      messagesTab,
      adPoolDraft.messages.join("\u0001"),
      adPoolDraft.interval,
      adPoolDraft.allBotsSelected ? "1" : "0",
      [...adPoolDraft.selectedBotIds].sort().join(","),
      adPoolDraft.allServersSelected ? "1" : "0",
      [...adPoolDraft.selectedServerIds].sort().join(","),
      n,
      linkedTargetsEpoch,
    ].join("|");
  }, [
    messagesTab,
    adPoolDraft,
    bots,
    adPoolMergedServers,
    linkedTargetsEpoch,
    serverUiLinksByBot,
  ]);

  useEffect(() => {
    if (messagesTab !== "adpool") return;
    if (!user?.id) return;
    for (const bid of effectivePoolBots(adPoolDraft, bots)) {
      if (!(bid in guildsByBot)) return;
    }
    const t = window.setTimeout(() => {
      const eBots = effectivePoolBots(adPoolDraft, botsRef.current);
      const merged = mergedServersForBotIds(eBots, guildsByBotRef.current);
      const targets = buildAdTargets(
        eBots,
        new Set(effectivePoolServers(adPoolDraft, merged)),
        serverUiLinksRef.current
      );
      void apiFetch("/api/messages-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uiMode: "adpool",
          adPool: {
            messages: adPoolDraft.messages,
            intervalLabel: adPoolDraft.interval,
            targets,
          },
        }),
      }).then(() => refreshMessagesState());
    }, 900);
    return () => window.clearTimeout(t);
  }, [adPoolSaveSig, messagesTab, user?.id, guildsByBot, refreshMessagesState]);

  if (!bots.length) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Messaging
          </p>
          <h1 className={styles.title}>Configure Message</h1>
          <p className={styles.lead}>
            Add a bot from the profile menu to configure messages and targets.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Messaging
          </p>
          <h1 className={styles.title}>Configure Message</h1>
          <p className={styles.lead}>
            Create one or more campaigns—each can use different bots, servers,
            and ad copy. Cooldowns apply per campaign. Delivery uses channels
            you linked on the <strong>Servers</strong> page. Changes here save
            automatically.
          </p>
        </div>
      </header>

      <div className={styles.modeTabs} role="tablist" aria-label="Messaging mode">
        <button
          type="button"
          role="tab"
          aria-selected={messagesTab === "basic"}
          className={`${styles.modeTab} ${messagesTab === "basic" ? styles.modeTabActive : ""}`}
          onClick={() => void selectTab("basic")}
        >
          Basic
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={messagesTab === "campaign"}
          className={`${styles.modeTab} ${messagesTab === "campaign" ? styles.modeTabActive : ""}`}
          onClick={() => setMessagesTab("campaign")}
        >
          Campaign
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={messagesTab === "adpool"}
          className={`${styles.modeTab} ${messagesTab === "adpool" ? styles.modeTabActive : ""}`}
          onClick={() => void selectTab("adpool")}
        >
          Ad pool
        </button>
      </div>

      {globalError ? (
        <p className={styles.campaignError} role="alert" style={{ marginBottom: "1rem" }}>
          {globalError}
        </p>
      ) : null}

      {messagesTab === "basic" ? (
        <>
          {messagesState?.burst ? (
            <div className={styles.pausedBanner} role="status">
              Basic posting is paused — a quota campaign is running (
              {messagesState.burst.quotaSent} / {messagesState.burst.quotaTotal}{" "}
              ads posted). Open the <strong>Campaign</strong> tab to manage or
              stop early.
            </div>
          ) : null}
          {messagesState?.uiMode === "adpool" &&
          (messagesState.adPool?.targets?.length ?? 0) > 0 &&
          (messagesState.adPool?.messages ?? []).some((m) =>
            String(m ?? "").trim()
          ) ? (
            <div className={`${styles.pausedBanner} ${styles.pausedBannerMuted}`}>
              Basic campaigns are paused while <strong>Ad pool</strong> rotation
              is active. Use the <strong>Ad pool</strong> tab to edit.
            </div>
          ) : null}
          <div className={styles.grid}>
        <div className={styles.colForm}>
          {campaigns.map((c) => {
            const merged = mergedServersByCampaignId.get(c.id) ?? [];
            const eBotIds = effectiveBots(c, bots);
            const eSrvIds = effectiveServerIdsForCampaign(c, merged);
            const eSrvSet = new Set(eSrvIds);
            const adTargetCount = buildAdTargets(
              eBotIds,
              eSrvSet,
              serverUiLinksByBot
            ).length;

            return (
              <div key={c.id} className={styles.campaignBlock}>
                <div className={styles.campaignHeader}>
                  <button
                    type="button"
                    className={styles.collapseBtn}
                    aria-expanded={!c.cardCollapsed}
                    onClick={() =>
                      updateCampaign(c.id, { cardCollapsed: !c.cardCollapsed })
                    }
                  >
                    {c.cardCollapsed ? (
                      <ChevronRight size={18} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={18} strokeWidth={2} />
                    )}
                  </button>
                  <input
                    type="text"
                    className={styles.campaignTitleInput}
                    value={c.title}
                    onChange={(e) =>
                      updateCampaign(c.id, { title: e.target.value })
                    }
                    aria-label="Campaign name"
                  />
                  <div className={styles.campaignHeaderActions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => resetCampaign(c.id)}
                    >
                      <RotateCcw size={16} strokeWidth={2} />
                      Reset
                    </button>
                    <button
                      type="button"
                      className={styles.btnDangerGhost}
                      onClick={() => void deleteCampaign(c.id)}
                      aria-label="Delete campaign"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {c.cardCollapsed ? (
                  <p className={styles.campaignSummary}>
                    {eBotIds.length} bot{eBotIds.length !== 1 ? "s" : ""} ·{" "}
                    {eSrvIds.length} server{eSrvIds.length !== 1 ? "s" : ""}
                  </p>
                ) : (
                  <>
                    <section className={styles.card}>
                      <div className={styles.cardHead}>
                        <div>
                          <h2 className={styles.cardTitle}>Targets</h2>
                          <p className={styles.cardDesc}>
                            Pick which bots run this campaign and which Discord
                            servers it applies to.
                          </p>
                        </div>
                      </div>

                      <MasterToggle
                        id={`toggle-all-bots-${c.id}`}
                        label="All bots"
                        description="Use every bot on your account for this campaign."
                        checked={c.allBotsSelected}
                        onChange={(v) => {
                          updateCampaign(c.id, {
                            allBotsSelected: v,
                            selectedBotIds: v ? [] : c.selectedBotIds,
                          });
                        }}
                      />
                      <ul className={styles.selectList} aria-label="Bots">
                        {bots.map((bot) => {
                          const checked =
                            c.allBotsSelected ||
                            c.selectedBotIds.includes(bot.id);
                          return (
                            <li key={bot.id}>
                              <label
                                className={`${styles.selectRow} ${checked ? styles.selectRowOn : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  className={styles.selectCheck}
                                  checked={checked}
                                  disabled={c.allBotsSelected}
                                  onChange={() => {
                                    updateCampaign(c.id, {
                                      allBotsSelected: false,
                                      selectedBotIds: c.selectedBotIds.includes(
                                        bot.id
                                      )
                                        ? c.selectedBotIds.filter(
                                            (x) => x !== bot.id
                                          )
                                        : [...c.selectedBotIds, bot.id],
                                    });
                                  }}
                                />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={discordAvatarUrl(bot, 64)}
                                  alt=""
                                  width={36}
                                  height={36}
                                  className={styles.selectRowAvatar}
                                />
                                <span className={styles.selectRowMain}>
                                  <span className={styles.selectRowTitle}>
                                    {bot.displayName}
                                  </span>
                                  <span className={styles.selectRowSub}>
                                    @{bot.username}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>

                      <div className={styles.targetsDivider} />

                      <div className={styles.serversSectionHead}>
                        <MasterToggle
                          id={`toggle-all-servers-${c.id}`}
                          label="All servers"
                          description="Include every cached server for the bots above."
                          checked={c.allServersSelected}
                          onChange={(v) => {
                            updateCampaign(c.id, {
                              allServersSelected: v,
                              selectedServerIds: v ? [] : c.selectedServerIds,
                            });
                          }}
                        />
                        <button
                          type="button"
                          className={styles.minimizeServersBtn}
                          aria-expanded={!c.serversCollapsed}
                          onClick={() =>
                            updateCampaign(c.id, {
                              serversCollapsed: !c.serversCollapsed,
                            })
                          }
                        >
                          {c.serversCollapsed ? (
                            <>
                              <ChevronRight size={16} strokeWidth={2} />
                              Show servers
                            </>
                          ) : (
                            <>
                              <ChevronDown size={16} strokeWidth={2} />
                              Hide list
                            </>
                          )}
                        </button>
                      </div>
                      {!eBotIds.length ? (
                        <p className={styles.hintMuted}>
                          Select at least one bot to load servers.
                        </p>
                      ) : merged.length === 0 ? (
                        <p className={styles.hintMuted}>
                          No servers in cache. Refresh guilds from the Servers
                          page.
                        </p>
                      ) : c.serversCollapsed ? (
                        <p className={styles.hintMuted}>
                          {eSrvIds.length} server
                          {eSrvIds.length !== 1 ? "s" : ""} selected
                        </p>
                      ) : (
                        <ul className={styles.selectList} aria-label="Servers">
                          {merged.map((s) => {
                            const checked =
                              c.allServersSelected ||
                              c.selectedServerIds.includes(s.id);
                            return (
                              <li key={s.id}>
                                <label
                                  className={`${styles.selectRow} ${checked ? styles.selectRowOn : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className={styles.selectCheck}
                                    checked={checked}
                                    disabled={c.allServersSelected}
                                    onChange={() => {
                                      updateCampaign(c.id, {
                                        allServersSelected: false,
                                        selectedServerIds:
                                          c.selectedServerIds.includes(s.id)
                                            ? c.selectedServerIds.filter(
                                                (x) => x !== s.id
                                              )
                                            : [...c.selectedServerIds, s.id],
                                      });
                                    }}
                                  />
                                  <span className={styles.selectRowMain}>
                                    <span className={styles.selectRowTitle}>
                                      {s.name}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <p className={styles.targetSummary}>
                        <strong>{eBotIds.length}</strong> bot
                        {eBotIds.length !== 1 ? "s" : ""} ·{" "}
                        <strong>{eSrvIds.length}</strong> server
                        {eSrvIds.length !== 1 ? "s" : ""}
                      </p>
                    </section>

                    <section className={styles.card}>
                      <div className={styles.cardHead}>
                        <div>
                          <h2 className={styles.cardTitle}>
                            Automated posting
                          </h2>
                          <p className={styles.cardDesc}>
                            Adzz posts your message on the schedule you set
                            to every linked channel that matches your targets
                            above. Make sure each bot can{" "}
                            <strong>Send Messages</strong> in those channels.
                            Pauses and errors for this campaign are shown below.
                          </p>
                          <p
                            className={styles.targetSummary}
                            style={{
                              marginTop: "0.65rem",
                              border: "none",
                              padding: 0,
                            }}
                          >
                            <strong>{adTargetCount}</strong> channel
                            {adTargetCount !== 1 ? "s" : ""} targeted · first
                            send within ~25s after you save (scheduler tick)
                          </p>
                          {c.lastSendError ? (
                            <p className={styles.campaignError} role="alert">
                              {c.lastSendError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>

                    <section className={styles.card}>
                      <h2 className={styles.cardTitle}>Message</h2>
                      <p className={styles.cardDesc}>
                        Ad copy supports Discord markdown: headers, quotes,
                        dividers, bold.
                      </p>
                      <textarea
                        id={`msg-body-${c.id}`}
                        className={`${styles.textarea} ${styles.textareaScrollbar}`}
                        value={c.message}
                        onChange={(e) =>
                          updateCampaign(c.id, { message: e.target.value })
                        }
                        onFocus={() => setPreviewCampaignId(c.id)}
                        spellCheck={false}
                        rows={16}
                      />
                    </section>

                    <section className={styles.card}>
                      <h2 className={styles.cardTitle}>Cooldown / interval</h2>
                      <p className={styles.cardDesc}>
                        Minimum time between sends for this campaign. When the
                        cooldown ends, the next message goes out right away.
                      </p>
                      <div className={styles.fieldNarrow}>
                        <div className={styles.selectWrap}>
                          <select
                            className={styles.select}
                            value={c.interval}
                            onChange={(e) =>
                              updateCampaign(c.id, { interval: e.target.value })
                            }
                            aria-label="Cooldown between sends"
                          >
                            {INTERVAL_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className={styles.selectIcon}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </section>

                    <section className={styles.card}>
                      <div className={styles.toggleRow}>
                        <div>
                          <h2 className={styles.cardTitle}>Send period</h2>
                          <p className={styles.cardDesc}>
                            Restrict sends to your configured active window.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.sendPeriod}
                          className={`${styles.toggle} ${c.sendPeriod ? styles.toggleOn : ""}`}
                          onClick={() =>
                            updateCampaign(c.id, { sendPeriod: !c.sendPeriod })
                          }
                        >
                          <span className={styles.toggleKnob} />
                        </button>
                      </div>
                    </section>

                    <section className={styles.card}>
                      <div className={styles.toggleRow}>
                        <div>
                          <div className={styles.titleRow}>
                            <h2 className={styles.cardTitle}>
                              Inactivity timeout
                            </h2>
                            <span className={styles.pillSoon}>Coming soon</span>
                          </div>
                          <p className={styles.cardDesc}>
                            Skip sends when the channel has been quiet for too
                            long.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.inactivityTimeout}
                          disabled
                          className={`${styles.toggle} ${styles.toggleDisabled}`}
                        >
                          <span className={styles.toggleKnob} />
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className={styles.addCampaignBtn}
            onClick={() => void addCampaign()}
          >
            <Plus size={18} strokeWidth={2} />
            Add campaign
          </button>
        </div>

        <div className={styles.colPreview}>
          <p className={styles.previewCaption}>Discord · live preview</p>
          <DiscordMessageLivePreview
            text={previewCampaign?.message ?? ""}
            bot={previewBot}
          />
        </div>
      </div>
        </>
      ) : null}

      {messagesTab === "campaign" ? (
        <div className={styles.quotaGate}>
          <div
            className={
              subscriptionTier !== null &&
              subscriptionTier !== "business"
                ? `${styles.grid} ${styles.quotaBlurLayer}`
                : styles.grid
            }
          >
            <div className={styles.colForm} style={{ maxWidth: "900px" }}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Quota campaign</h2>
                <p className={styles.cardDesc}>
                  Pick one bot, enter ad copy, how many total posts you want, and
                  the interval between rounds. While this runs,{" "}
                  <strong>Basic</strong> posting pauses; when the quota is reached,
                  Basic resumes automatically.
                </p>
                {messagesState?.burst ? (
                  <p className={styles.campaignError} role="status">
                    Running: {messagesState.burst.quotaSent} /{" "}
                    {messagesState.burst.quotaTotal} ads posted.
                  </p>
                ) : null}
                <div className={styles.fieldNarrow} style={{ marginTop: "0.75rem" }}>
                  <label className={styles.cardDesc} htmlFor="burst-bot">
                    Bot
                  </label>
                  <div className={styles.selectWrap}>
                    <select
                      id="burst-bot"
                      className={styles.select}
                      value={burstBotId}
                      onChange={(e) => setBurstBotId(e.target.value)}
                      disabled={Boolean(messagesState?.burst)}
                    >
                      {bots.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.displayName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} strokeWidth={2} className={styles.selectIcon} aria-hidden />
                  </div>
                </div>
                <p className={styles.cardDesc} style={{ marginTop: "0.75rem" }}>
                  Targets are every channel you linked for this bot on the Servers
                  page.
                </p>
                <label className={styles.cardDesc} htmlFor="burst-msg">
                  Ad message
                </label>
                <textarea
                  id="burst-msg"
                  className={`${styles.textarea} ${styles.textareaScrollbar}`}
                  rows={12}
                  value={burstMessage}
                  onChange={(e) => setBurstMessage(e.target.value)}
                  disabled={Boolean(messagesState?.burst)}
                />
                <div className={styles.fieldNarrow} style={{ marginTop: "0.75rem" }}>
                  <label className={styles.cardDesc} htmlFor="burst-quota">
                    Total ads to post
                  </label>
                  <input
                    id="burst-quota"
                    type="number"
                    min={1}
                    className={styles.select}
                    style={{ maxWidth: "12rem" }}
                    value={burstQuota}
                    onChange={(e) =>
                      setBurstQuota(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                    }
                    disabled={Boolean(messagesState?.burst)}
                  />
                </div>
                <div className={styles.fieldNarrow}>
                  <label className={styles.cardDesc}>Interval</label>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={burstInterval}
                      onChange={(e) => setBurstInterval(e.target.value)}
                      disabled={Boolean(messagesState?.burst)}
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} strokeWidth={2} className={styles.selectIcon} aria-hidden />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "1rem" }}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={burstBusy || Boolean(messagesState?.burst)}
                    onClick={() => void startBurstCampaign()}
                  >
                    {messagesState?.burst ? "Campaign running" : "Start campaign"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={burstBusy || !messagesState?.burst}
                    onClick={() => void stopBurstCampaign()}
                  >
                    Stop early
                  </button>
                </div>
              </section>
            </div>
            <div className={styles.colPreview}>
              <p className={styles.previewCaption}>Discord · live preview</p>
              <DiscordMessageLivePreview
                text={burstMessage}
                bot={bots.find((b) => b.id === burstBotId) ?? null}
              />
            </div>
          </div>
          {user?.id && subscriptionTier !== "business" ? (
            <div className={styles.quotaGateOverlay} aria-live="polite">
              <div className={styles.quotaGateCallout}>
                <p className={styles.quotaGateTitle}>
                  {subscriptionTier === null
                    ? "Checking subscription…"
                    : "You need an Adzz Business subscription for this"}
                </p>
                {subscriptionTier !== null ? (
                  <>
                    <p className={styles.quotaGateDesc}>
                      Quota campaigns are included with{" "}
                      <strong>Adzz Business</strong>. Upgrade to send a fixed
                      number of ads, then return to normal posting automatically.
                    </p>
                    <Link href="/subscriptions" className={styles.quotaGateCta}>
                      View plans & subscribe
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {messagesTab === "adpool" ? (
        <div className={styles.grid}>
          <div className={styles.colForm}>
            <p className={styles.poolHint}>
              Ad pool rotates through your messages in order (first send uses ad
              1, next ad 2, and so on). Use <strong>Basic</strong> or{" "}
              <strong>Ad pool</strong> — not both at once for posting; switching
              here updates server mode.
            </p>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Targets</h2>
                  <p className={styles.cardDesc}>
                    Same as Basic — choose bots and servers; posts go to linked
                    channels.
                  </p>
                </div>
              </div>
              <MasterToggle
                id="pool-toggle-all-bots"
                label="All bots"
                description="Use every bot on your account."
                checked={adPoolDraft.allBotsSelected}
                onChange={(v) =>
                  setAdPoolDraft((p) => ({
                    ...p,
                    allBotsSelected: v,
                    selectedBotIds: v ? [] : p.selectedBotIds,
                  }))
                }
              />
              <ul className={styles.selectList} aria-label="Bots">
                {bots.map((bot) => {
                  const checked =
                    adPoolDraft.allBotsSelected ||
                    adPoolDraft.selectedBotIds.includes(bot.id);
                  return (
                    <li key={bot.id}>
                      <label
                        className={`${styles.selectRow} ${checked ? styles.selectRowOn : ""}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.selectCheck}
                          checked={checked}
                          disabled={adPoolDraft.allBotsSelected}
                          onChange={() =>
                            setAdPoolDraft((p) => ({
                              ...p,
                              allBotsSelected: false,
                              selectedBotIds: p.selectedBotIds.includes(bot.id)
                                ? p.selectedBotIds.filter((x) => x !== bot.id)
                                : [...p.selectedBotIds, bot.id],
                            }))
                          }
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={discordAvatarUrl(bot, 64)}
                          alt=""
                          width={36}
                          height={36}
                          className={styles.selectRowAvatar}
                        />
                        <span className={styles.selectRowMain}>
                          <span className={styles.selectRowTitle}>
                            {bot.displayName}
                          </span>
                          <span className={styles.selectRowSub}>
                            @{bot.username}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.targetsDivider} />
              <MasterToggle
                id="pool-toggle-all-servers"
                label="All servers"
                description="Include every cached server for the bots above."
                checked={adPoolDraft.allServersSelected}
                onChange={(v) =>
                  setAdPoolDraft((p) => ({
                    ...p,
                    allServersSelected: v,
                    selectedServerIds: v ? [] : p.selectedServerIds,
                  }))
                }
              />
              {!effectivePoolBots(adPoolDraft, bots).length ? (
                <p className={styles.hintMuted}>Select at least one bot.</p>
              ) : adPoolMergedServers.length === 0 ? (
                <p className={styles.hintMuted}>
                  No servers in cache. Open the Servers page to refresh guilds.
                </p>
              ) : !adPoolDraft.serversCollapsed ? (
                <ul className={styles.selectList} aria-label="Servers">
                  {adPoolMergedServers.map((s) => {
                    const checked =
                      adPoolDraft.allServersSelected ||
                      adPoolDraft.selectedServerIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label
                          className={`${styles.selectRow} ${checked ? styles.selectRowOn : ""}`}
                        >
                          <input
                            type="checkbox"
                            className={styles.selectCheck}
                            checked={checked}
                            disabled={adPoolDraft.allServersSelected}
                            onChange={() =>
                              setAdPoolDraft((p) => ({
                                ...p,
                                allServersSelected: false,
                                selectedServerIds: p.selectedServerIds.includes(
                                  s.id
                                )
                                  ? p.selectedServerIds.filter((x) => x !== s.id)
                                  : [...p.selectedServerIds, s.id],
                              }))
                            }
                          />
                          <span className={styles.selectRowMain}>
                            <span className={styles.selectRowTitle}>{s.name}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.hintMuted}>
                  {effectivePoolServers(adPoolDraft, adPoolMergedServers).length}{" "}
                  server
                  {effectivePoolServers(adPoolDraft, adPoolMergedServers)
                    .length !== 1
                    ? "s"
                    : ""}{" "}
                  selected ·{" "}
                  <button
                    type="button"
                    className={styles.minimizeServersBtn}
                    onClick={() =>
                      setAdPoolDraft((p) => ({
                        ...p,
                        serversCollapsed: false,
                      }))
                    }
                  >
                    Show servers
                  </button>
                </p>
              )}
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Ad rotation (messages)</h2>
              <p className={styles.cardDesc}>
                Each non-empty message is used in order for each scheduled send.
              </p>
              {adPoolDraft.messages.map((m, i) => (
                <div key={i} className={styles.msgListRow}>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaScrollbar}`}
                    rows={6}
                    value={m}
                    onChange={(e) =>
                      setAdPoolDraft((p) => {
                        const next = [...p.messages];
                        next[i] = e.target.value;
                        return { ...p, messages: next };
                      })
                    }
                  />
                  <button
                    type="button"
                    className={styles.msgListRemove}
                    aria-label="Remove message"
                    onClick={() =>
                      setAdPoolDraft((p) => ({
                        ...p,
                        messages: p.messages.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 size={18} strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: "0.5rem" }}
                onClick={() =>
                  setAdPoolDraft((p) => ({
                    ...p,
                    messages: [...p.messages, ""],
                  }))
                }
              >
                Add message variant
              </button>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Cooldown / interval</h2>
              <div className={styles.fieldNarrow}>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={adPoolDraft.interval}
                    onChange={(e) =>
                      setAdPoolDraft((p) => ({
                        ...p,
                        interval: e.target.value,
                      }))
                    }
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} strokeWidth={2} className={styles.selectIcon} aria-hidden />
                </div>
              </div>
              <p className={styles.cardDesc} style={{ marginTop: "0.65rem" }}>
                Saves automatically a moment after you edit (same as Basic).
              </p>
            </section>
          </div>
          <div className={styles.colPreview}>
            <p className={styles.previewCaption}>Discord · live preview</p>
            <DiscordMessageLivePreview
              text={
                adPoolDraft.messages.find((x) => String(x).trim()) ??
                DEFAULT_MESSAGE
              }
              bot={
                bots.find((b) => b.id === effectivePoolBots(adPoolDraft, bots)[0]) ??
                null
              }
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}
