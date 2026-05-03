"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Bot,
  Crown,
  Gamepad2,
  Gem,
  Hash,
  Megaphone,
  MessageSquare,
  Radio,
  Rocket,
  Send,
  Server,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { discordAvatarUrl } from "@/lib/discordAvatar";
import { MiniSparkline } from "@/components/dashboard/mini-sparkline";
import type { ActivityPoint, ActivityRange } from "./PerformanceOverviewChart";
import styles from "./dashboard-overview.module.css";
import pack from "./icon-pack.module.css";

const PerformanceOverviewChart = dynamic(
  () =>
    import("./PerformanceOverviewChart").then((m) => ({
      default: m.PerformanceOverviewChart,
    })),
  {
    ssr: false,
    loading: () => <div className={styles.chartSkeletonTall} />,
  }
);

type BotRow = {
  id: string;
  discordUserId?: string;
  avatar?: string | null;
  displayName: string;
  status: string;
  healthPct: number;
  errors24h: number;
};

type TargetCard = {
  id: string;
  channelName: string;
  serverName: string;
  adsSent: number;
  paused: boolean;
  lastError: string | null;
};

type DashboardPayload = {
  botCount: number;
  guildCount: number;
  totalMessagesSent: number;
  dailyByDate: Record<string, number>;
  hourlyByKey: Record<string, number>;
  liveUpdates: {
    id: string;
    channel: string;
    server: string;
    at: number;
  }[];
  messagesToday: number;
  activeCampaigns: number;
  successRate: number | null;
  weekDeltaPct: number;
  messagesRolling7d: number;
  deliveryFailures7d: number;
  logErrorsByDay7: number[];
  channelTargetCount: number;
  botsHealthy: number;
  botRows: BotRow[];
  targetCards: TargetCard[];
  messagesThisMonth: number;
  messagesLastMonth: number;
  subscriptionDaysLeft: number;
  subscriptionDaysTotal: number;
};

const ACTIVITY_RANGE_LABELS: { id: ActivityRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
];

const TARGET_ICONS = [Rocket, Gem, Gamepad2, Radio, Zap, Megaphone] as const;

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

function formatRelativeLastRun(atMs: number, nowMs: number): string {
  const delta = Math.max(0, nowMs - atMs);
  const sec = Math.floor(delta / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatLastRunAt(atMs);
}

function lastNDayTotals(
  daily: Record<string, number>,
  n: number,
  nowMs: number
): number[] {
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowMs);
    d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    out.push(Math.max(0, Math.floor(Number(daily[k]) || 0)));
  }
  return out;
}

const WEEK_SHORT_MON = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

function buildActivityToday(
  hourly: Record<string, number>,
  nowMs: number
): ActivityPoint[] {
  const base = new Date(nowMs);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const dDay = base.getUTCDate();
  const out: ActivityPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(dDay).padStart(2, "0")}T${String(h).padStart(2, "0")}`;
    const v = Math.max(0, Math.floor(Number(hourly[key]) || 0));
    out.push({
      label: `${String(h).padStart(2, "0")}:00`,
      value: v,
    });
  }
  return out;
}

function buildActivityWeek(
  daily: Record<string, number>,
  nowMs: number
): ActivityPoint[] {
  const now = new Date(nowMs);
  const dow = now.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + mondayOffset
    )
  );
  const out: ActivityPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const value = Math.max(0, Math.floor(Number(daily[key]) || 0));
    out.push({ label: WEEK_SHORT_MON[i], value });
  }
  return out;
}

function buildActivityMonth(
  daily: Record<string, number>,
  nowMs: number
): ActivityPoint[] {
  const now = new Date(nowMs);
  const y = now.getUTCFullYear();
  const mon = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, mon + 1, 0)).getUTCDate();
  const out: ActivityPoint[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${y}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const value = Math.max(0, Math.floor(Number(daily[key]) || 0));
    out.push({ label: String(day), value });
  }
  return out;
}

function buildActivityYear(
  daily: Record<string, number>,
  nowMs: number
): ActivityPoint[] {
  const now = new Date(nowMs);
  const y = now.getUTCFullYear();
  const out: ActivityPoint[] = [];
  for (let mo = 0; mo < 12; mo++) {
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    let sum = 0;
    for (let day = 1; day <= dim; day++) {
      const key = `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      sum += Math.max(0, Math.floor(Number(daily[key]) || 0));
    }
    const label = new Date(Date.UTC(y, mo, 1)).toLocaleString("en-US", {
      month: "short",
    });
    out.push({ label, value: sum });
  }
  return out;
}

function formatStat(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 100) / 10}k`;
  return n.toLocaleString();
}

function formatDeltaPct(n: number): string {
  if (n === 0) return "0%";
  const sign = n > 0 ? "+" : "";
  const rounded = Math.round(n);
  const abs = Math.abs(rounded);
  const body = abs >= 1000 ? abs.toLocaleString() : String(abs);
  return `${sign}${body}%`;
}

function liveCopy(channel: string, server: string) {
  const ch = channel.startsWith("#") ? channel : `#${channel}`;
  return {
    title: `Message sent in ${ch}`,
    meta: `Server · ${server}`,
  };
}

export function DashboardOverview() {
  const [activityRange, setActivityRange] = useState<ActivityRange>("today");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chartNow, setChartNow] = useState(() => Date.now());
  const [wallNow, setWallNow] = useState(() => Date.now());
  const seenLiveIdsRef = useRef<Set<string> | null>(null);
  const [slideInIds, setSlideInIds] = useState<Set<string>>(() => new Set());

  const fetchDashboard = useCallback(async () => {
    setLoadError(null);
    const res = await apiFetch("/api/dashboard");
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setLoadError(data.error ?? `Could not load (${res.status})`);
      return;
    }
    const data = (await res.json()) as DashboardPayload;
    setPayload(data);
    setChartNow(Date.now());
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      void fetchDashboard();
    }, 2000);
    return () => window.clearInterval(id);
  }, [fetchDashboard]);

  useEffect(() => {
    const id = window.setInterval(() => setWallNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setChartNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const rows = payload?.liveUpdates;
    if (!rows?.length) return;

    if (seenLiveIdsRef.current === null) {
      seenLiveIdsRef.current = new Set(rows.map((r) => r.id));
      return;
    }

    const newIds = rows
      .map((r) => r.id)
      .filter((id) => !seenLiveIdsRef.current!.has(id));
    for (const id of rows.map((r) => r.id)) {
      seenLiveIdsRef.current!.add(id);
    }
    if (seenLiveIdsRef.current.size > 300) {
      const asArr = [...seenLiveIdsRef.current];
      seenLiveIdsRef.current = new Set(asArr.slice(-300));
    }

    if (!newIds.length) return;

    setSlideInIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
    const t = window.setTimeout(() => {
      setSlideInIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
    }, 480);
    return () => window.clearTimeout(t);
  }, [payload?.liveUpdates]);

  const activityData = useMemo(() => {
    const daily = payload?.dailyByDate ?? {};
    const hourly = payload?.hourlyByKey ?? {};
    switch (activityRange) {
      case "today":
        return buildActivityToday(hourly, chartNow);
      case "week":
        return buildActivityWeek(daily, chartNow);
      case "month":
        return buildActivityMonth(daily, chartNow);
      case "year":
      default:
        return buildActivityYear(daily, chartNow);
    }
  }, [payload, activityRange, chartNow]);

  const sparkMessages = useMemo(
    () => lastNDayTotals(payload?.dailyByDate ?? {}, 7, chartNow),
    [payload, chartNow]
  );

  const sparkErrors = useMemo(() => {
    const raw = payload?.logErrorsByDay7;
    if (Array.isArray(raw) && raw.length === 7) return raw;
    return [0, 0, 0, 0, 0, 0, 0];
  }, [payload?.logErrorsByDay7]);

  const exportActivityCsv = useCallback(() => {
    const header = "label,messages";
    const rows = activityData.map((d) => `${d.label},${d.value}`);
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `message-activity-${activityRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activityData, activityRange]);

  const stats: DashboardPayload = {
    botCount: payload?.botCount ?? 0,
    guildCount: payload?.guildCount ?? 0,
    totalMessagesSent: payload?.totalMessagesSent ?? 0,
    dailyByDate: payload?.dailyByDate ?? {},
    hourlyByKey: payload?.hourlyByKey ?? {},
    liveUpdates: payload?.liveUpdates ?? [],
    messagesToday: payload?.messagesToday ?? 0,
    activeCampaigns: payload?.activeCampaigns ?? 0,
    successRate: payload?.successRate ?? null,
    weekDeltaPct: payload?.weekDeltaPct ?? 0,
    messagesRolling7d: payload?.messagesRolling7d ?? 0,
    deliveryFailures7d: payload?.deliveryFailures7d ?? 0,
    logErrorsByDay7: sparkErrors,
    channelTargetCount: payload?.channelTargetCount ?? 0,
    botsHealthy: payload?.botsHealthy ?? 0,
    botRows: payload?.botRows ?? [],
    targetCards: payload?.targetCards ?? [],
    messagesThisMonth: payload?.messagesThisMonth ?? 0,
    messagesLastMonth: payload?.messagesLastMonth ?? 0,
    subscriptionDaysLeft: payload?.subscriptionDaysLeft ?? 7,
    subscriptionDaysTotal: payload?.subscriptionDaysTotal ?? 28,
  };

  const successDisplay =
    stats.successRate == null ? "—" : `${stats.successRate}%`;

  const botsOnlineLabel =
    stats.botCount === 0
      ? "0"
      : `${stats.botsHealthy} / ${stats.botCount}`;

  const botOnlinePct =
    stats.botCount === 0
      ? 0
      : Math.round((stats.botsHealthy / stats.botCount) * 100);

  const subscriptionPct =
    stats.subscriptionDaysTotal > 0
      ? Math.round(
          (stats.subscriptionDaysLeft / stats.subscriptionDaysTotal) * 100
        )
      : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden />
          Overview
        </p>
        <h1 className={styles.title}>Dashboard</h1>
      </header>

      {loadError ? (
        <p className={styles.bannerErr} role="alert">
          {loadError}
        </p>
      ) : null}

      <div className={styles.kpiRow}>
        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackPurple}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackPurple}`}>
            <Megaphone size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Active campaigns</span>
            <span className={styles.kpiValue}>
              {stats.activeCampaigns.toLocaleString()}
            </span>
            <span className={styles.kpiTrendMuted}>
              {stats.channelTargetCount.toLocaleString()} channel targets
            </span>
          </div>
          <MiniSparkline values={sparkMessages} stroke="#c084fc" />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackBlue}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackBlue}`}>
            <MessageSquare size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Messages sent today</span>
            <span className={styles.kpiValue}>
              {stats.messagesToday.toLocaleString()}
            </span>
            <span
              className={
                stats.weekDeltaPct >= 0 ? styles.kpiTrendUp : styles.kpiTrendDown
              }
            >
              {formatDeltaPct(stats.weekDeltaPct)} vs prior week (sends)
            </span>
          </div>
          <MiniSparkline
            values={sparkMessages}
            stroke="#60a5fa"
            glow="rgba(96, 165, 250, 0.4)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackGreen}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackGreen}`}>
            <MessageSquare size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Messages (7 days)</span>
            <span className={styles.kpiValue}>
              {stats.messagesRolling7d.toLocaleString()}
            </span>
            <span className={styles.kpiTrendMuted}>
              Sum of UTC daily send counts
            </span>
          </div>
          <MiniSparkline
            values={sparkMessages}
            stroke="#4ade80"
            glow="rgba(74, 222, 128, 0.35)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackAmber}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackAmber}`}>
            <Zap size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Delivery health</span>
            <span className={styles.kpiValue}>{successDisplay}</span>
            <span className={styles.kpiTrendMuted}>
              {stats.messagesRolling7d + stats.deliveryFailures7d === 0
                ? "No sends logged in the last 7 UTC days"
                : `${stats.messagesRolling7d.toLocaleString()} sends · ${stats.deliveryFailures7d.toLocaleString()} failed (same window)`}
            </span>
          </div>
          <MiniSparkline
            values={sparkErrors}
            stroke="#fb7185"
            glow="rgba(251, 113, 133, 0.35)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackPink}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackPink}`}>
            <Bot size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Bots ready</span>
            <span className={styles.kpiValue}>{botsOnlineLabel}</span>
            <span className={styles.kpiTrendMuted}>
              {stats.botCount === 0
                ? "Add a token to start"
                : `${botOnlinePct}% active (posting on schedule or no errors in 24h)`}
            </span>
          </div>
          <div className={styles.kpiSparkPad} aria-hidden />
        </div>
      </div>

      <div className={styles.kpiRowSecondary}>
        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackOrange}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackOrange}`}>
            <Send size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Messages sent last month</span>
            <span className={styles.kpiValue}>
              {formatStat(stats.messagesLastMonth)}
            </span>
            <span className={styles.kpiTrendMuted}>
              Full prior UTC calendar month
            </span>
          </div>
          <MiniSparkline
            values={sparkMessages}
            stroke="#fb923c"
            glow="rgba(251, 146, 60, 0.45)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackBlue}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackBlue}`}>
            <MessageSquare size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Messages sent this month</span>
            <span className={styles.kpiValue}>
              {formatStat(stats.messagesThisMonth)}
            </span>
            <span className={styles.kpiTrendMuted}>
              UTC month to date from send history
            </span>
          </div>
          <MiniSparkline
            values={sparkMessages}
            stroke="#38bdf8"
            glow="rgba(56, 189, 248, 0.45)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackPink}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackPink}`}>
            <Hash size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Total channels configured</span>
            <span className={styles.kpiValue}>
              {stats.channelTargetCount.toLocaleString()}
            </span>
            <span className={styles.kpiTrendMuted}>
              Unique channel targets across campaigns
            </span>
          </div>
          <MiniSparkline
            values={sparkMessages}
            stroke="#f472b6"
            glow="rgba(244, 114, 182, 0.45)"
          />
        </div>

        <div
          className={`${styles.kpiCard} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
        >
          <div className={`${pack.iconPack} ${pack.iconPackNeutral}`}>
            <Crown size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Subscription days left</span>
            <span className={styles.kpiValue}>
              {`${stats.subscriptionDaysLeft.toLocaleString()} / ${stats.subscriptionDaysTotal}`}
            </span>
            <span className={styles.kpiTrendMuted}>
              {subscriptionPct}% of billing cycle remaining
            </span>
          </div>
          <div className={styles.kpiSparkPad} aria-hidden />
        </div>
      </div>

      <div className={styles.middleGrid}>
        <section className={styles.perfCard}>
          <div className={styles.perfCardHeader}>
            <div className={styles.perfTitleBlock}>
              <h2 className={styles.perfTitle}>Message activity</h2>
              <p className={styles.perfSubtitle}>
                Today uses hourly totals; week/month/year use UTC calendar
                buckets from your send history.
              </p>
            </div>
            <div className={styles.perfControls}>
              {ACTIVITY_RANGE_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.pill} ${activityRange === id ? styles.chartPillActive : ""}`}
                  onClick={() => setActivityRange(id)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={styles.exportBtn}
                onClick={exportActivityCsv}
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className={styles.perfChartWrap}>
            <PerformanceOverviewChart data={activityData} range={activityRange} />
          </div>
        </section>

        <aside className={styles.liveCard}>
          <div className={styles.liveHeader}>
            <h2 className={styles.liveTitle}>Live activity</h2>
            <Link href="/logs" className={styles.linkQuiet}>
              View all
            </Link>
          </div>
          <ul className={styles.liveList}>
            {stats.liveUpdates.length === 0 ? (
              <li className={styles.liveItem}>
                <div className={styles.liveRow}>
                  <div
                    className={`${pack.iconPack} ${pack.iconPackLive} ${pack.iconPackMuted}`}
                  >
                    <Send size={16} strokeWidth={1.75} />
                  </div>
                  <div className={styles.liveText}>
                    <div className={styles.liveTitleLine}>No sends yet</div>
                    <div className={styles.liveMetaLine}>
                      Enable a campaign and targets to see activity
                    </div>
                    <div className={styles.liveTime}>—</div>
                  </div>
                </div>
              </li>
            ) : (
              stats.liveUpdates.map((row) => {
                const { title, meta } = liveCopy(row.channel, row.server);
                return (
                  <li
                    key={row.id}
                    className={`${styles.liveItem} ${
                      slideInIds.has(row.id) ? styles.liveItemSlideIn : ""
                    }`}
                  >
                    <div className={styles.liveRow}>
                      <div
                        className={`${pack.iconPack} ${pack.iconPackLive} ${pack.iconPackGreen}`}
                      >
                        <Send size={16} strokeWidth={1.75} />
                      </div>
                      <div className={styles.liveText}>
                        <div className={styles.liveTitleLine}>{title}</div>
                        <div className={styles.liveMetaLine}>{meta}</div>
                        <div
                          className={styles.liveTime}
                          title={formatLastRunAt(row.at)}
                        >
                          {formatRelativeLastRun(row.at, wallNow)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Channel targets</h3>
            <Link href="/messages" className={styles.panelLinkBtn}>
              Edit campaign
            </Link>
          </div>
          <div className={styles.panelScroll}>
            {stats.targetCards.length === 0 ? (
              <p className={styles.panelEmpty}>
                Add channels under Messages to see per-target stats here.
              </p>
            ) : (
              <ul className={styles.targetList}>
                {stats.targetCards.map((t, i) => {
                  const Icon = TARGET_ICONS[i % TARGET_ICONS.length];
                return (
                  <li key={t.id} className={styles.targetCard}>
                    <div
                      className={`${pack.iconPack} ${pack.iconPackSm} ${
                        i % 3 === 0
                          ? pack.iconPackPurple
                          : i % 3 === 1
                            ? pack.iconPackPink
                            : pack.iconPackBlue
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </div>
                      <div className={styles.targetMain}>
                        <div className={styles.targetHead}>
                          <span className={styles.targetName}>
                            #{t.channelName}
                          </span>
                          <span
                            className={
                              t.paused
                                ? styles.badgePaused
                                : styles.badgeRunning
                            }
                          >
                            {t.paused ? "Paused" : "Running"}
                          </span>
                        </div>
                        <div className={styles.targetServer}>{t.serverName}</div>
                        <div className={styles.targetStats}>
                          <span>
                            Sent{" "}
                            <strong>{t.adsSent.toLocaleString()}</strong>
                          </span>
                          <span title={t.lastError ?? undefined}>
                            Last send:{" "}
                            <strong>
                              {t.lastError == null ? "OK" : "Error"}
                            </strong>
                          </span>
                        </div>
                        {t.lastError ? (
                          <div className={styles.targetErrDetail}>{t.lastError}</div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Bot accounts</h3>
            <Link href="/servers" className={styles.panelLinkBtn}>
              Servers
            </Link>
          </div>
          <div className={`${styles.panelScroll} ${styles.botScroll}`}>
            {stats.botRows.length === 0 ? (
              <p className={styles.panelEmpty}>
                Add a bot token to monitor account health here.
              </p>
            ) : (
              <ul className={styles.botList}>
                {stats.botRows.map((b) => (
                  <li key={b.id} className={styles.botRow}>
                    <div className={styles.botTop}>
                      <div className={styles.botTopMain}>
                        <div className={pack.avatarRingBot}>
                          <div className={pack.avatarRingBotInner}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={discordAvatarUrl(
                                {
                                  discordUserId: b.discordUserId ?? "",
                                  avatar: b.avatar ?? null,
                                },
                                64
                              )}
                              alt=""
                              className={styles.botRowAvatar}
                              width={32}
                              height={32}
                            />
                          </div>
                        </div>
                        <div className={styles.botName}>{b.displayName}</div>
                      </div>
                      <div
                        className={
                          b.status === "error"
                            ? styles.botStatusErr
                            : b.status === "cooldown"
                              ? styles.botStatusWarn
                              : styles.botStatusOk
                        }
                      >
                        {b.status === "error"
                          ? "Error"
                          : b.status === "cooldown"
                            ? "Cooling down"
                            : "Online"}
                      </div>
                    </div>
                    <div className={styles.healthRow}>
                      <div
                        className={styles.healthTrack}
                        role="presentation"
                        title={`Health ${b.healthPct}%, ${b.errors24h} errors (24h)`}
                      >
                        <div
                          className={`${styles.healthFill} ${
                            b.status === "error"
                              ? styles.healthErr
                              : b.status === "cooldown"
                                ? styles.healthWarn
                                : styles.healthOk
                          }`}
                          style={{ width: `${b.healthPct}%` }}
                        />
                      </div>
                      <div className={styles.healthPct}>{b.healthPct}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Quick stats</h3>
          </div>
          <div className={styles.quickGrid}>
            <div
              className={`${pack.kpiCardPack} ${pack.kpiCardPackNeutral} ${styles.quickCellAdreach}`}
            >
              <div className={styles.quickLabel}>Total servers</div>
              <div className={styles.quickValue}>
                {stats.guildCount.toLocaleString()}
              </div>
              <div className={styles.quickSub}>Across connected bots</div>
            </div>
            <div
              className={`${pack.kpiCardPack} ${pack.kpiCardPackNeutral} ${styles.quickCellAdreach}`}
            >
              <div className={styles.quickLabel}>Total bots</div>
              <div className={styles.quickValue}>
                {stats.botCount.toLocaleString()}
              </div>
              <div className={styles.quickSub}>Token-backed accounts</div>
            </div>
            <div
              className={`${pack.kpiCardPack} ${pack.kpiCardPackNeutral} ${styles.quickCellAdreach}`}
            >
              <div className={styles.quickLabel}>Total messages</div>
              <div className={styles.quickValue}>
                {formatStat(stats.totalMessagesSent)}
              </div>
              <div
                className={
                  stats.weekDeltaPct >= 0 ? styles.quickSubUp : styles.quickSubDown
                }
              >
                {formatDeltaPct(stats.weekDeltaPct)} weekly sends
              </div>
            </div>
            <div
              className={`${pack.kpiCardPack} ${pack.kpiCardPackNeutral} ${styles.quickCellAdreach}`}
            >
              <div className={styles.quickLabel}>Messages (7d)</div>
              <div className={styles.quickValue}>
                {stats.messagesRolling7d.toLocaleString()}
              </div>
              <div className={styles.quickSub}>UTC days, from send history</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
