"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";

const ACTIVE_BOT_KEY = "adzz_active_bot";

/** Poll GET /guilds until server reports `guildSyncInProgress` is not true (202 async sync). */
async function waitUntilGuildSyncSettles(
  botId: string,
  maxWaitMs: number
): Promise<{ ok: true } | { ok: false; error?: string }> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 400));
  while (Date.now() - start < maxWaitMs) {
    const gRes = await apiFetch(
      `/api/bots/${botId}/guilds`,
      {},
      { timeoutMs: 35_000, quietLog: true }
    );
    if (gRes.ok) {
      const body = (await gRes.json().catch(() => ({}))) as {
        guildSyncInProgress?: boolean;
      };
      if (body.guildSyncInProgress !== true) {
        return { ok: true };
      }
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return {
    ok: false,
    error:
      "Discord sync is still running on the server. Refresh in a moment to load the full server list.",
  };
}

export type BotSummary = {
  id: string;
  discordUserId: string;
  displayName: string;
  username: string;
  avatar: string | null;
  tokenType: string;
  accountEmail: string | null;
  createdAt: number;
};

/** Persisted “linked channel” picks from the Servers page (guildId → channels). */
export type ServerUiLinksByBot = Record<
  string,
  Record<string, { id: string; name: string }[]>
>;

type SyncGuildsResult = { ok: true } | { ok: false; error?: string };

type RefreshProfileResult =
  | { ok: true }
  | { ok: false; error?: string };

type BotCtx = {
  bots: BotSummary[];
  activeBotId: string | null;
  setActiveBotId: (id: string) => void;
  refreshBots: () => Promise<BotSummary[]>;
  deleteBot: (botId: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
  refreshBotProfile: (botId: string) => Promise<RefreshProfileResult>;
  syncing: boolean;
  syncGuilds: (botId: string) => Promise<SyncGuildsResult>;
  serverUiLinksByBot: ServerUiLinksByBot;
  refreshServerUiLinks: () => Promise<void>;
  saveServerUiLinks: (
    botId: string,
    guildChannels: Record<string, { id: string; name: string }[]>
  ) => Promise<{ ok: true } | { ok: false; error?: string }>;
};

const BotContext = createContext<BotCtx | null>(null);

export function BotProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [activeBotId, setActiveState] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [serverUiLinksByBot, setServerUiLinksByBot] =
    useState<ServerUiLinksByBot>({});

  const refreshBots = useCallback(async (): Promise<BotSummary[]> => {
    if (!user) {
      setBots([]);
      return [];
    }
    const res = await apiFetch("/api/bots");
    if (!res.ok) return [];
    const data = (await res.json()) as { bots: BotSummary[] };
    const list = data.bots ?? [];
    setBots(list);
    return list;
  }, [user]);

  const refreshServerUiLinks = useCallback(async () => {
    if (!user) {
      setServerUiLinksByBot({});
      return;
    }
    const res = await apiFetch("/api/servers-ui-links");
    if (!res.ok) return;
    const data = (await res.json()) as { links?: ServerUiLinksByBot };
    setServerUiLinksByBot(data.links ?? {});
  }, [user]);

  const deleteBot = useCallback(
    async (
      botId: string
    ): Promise<{ ok: true } | { ok: false; error?: string }> => {
      const res = await apiFetch(`/api/bots/${encodeURIComponent(botId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        return {
          ok: false,
          error: data.error ?? `Could not delete bot (${res.status})`,
        };
      }
      const list = await refreshBots();
      setActiveState((cur) => {
        if (cur !== botId) return cur;
        const next = list[0]?.id ?? null;
        if (typeof window !== "undefined") {
          if (next) localStorage.setItem(ACTIVE_BOT_KEY, next);
          else localStorage.removeItem(ACTIVE_BOT_KEY);
        }
        return next;
      });
      await refreshServerUiLinks();
      return { ok: true };
    },
    [refreshBots, refreshServerUiLinks]
  );

  const saveServerUiLinks = useCallback(
    async (
      botId: string,
      guildChannels: Record<string, { id: string; name: string }[]>
    ): Promise<{ ok: true } | { ok: false; error?: string }> => {
      const res = await apiFetch(`/api/bots/${botId}/servers-ui-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildChannels }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        guildChannels?: Record<string, { id: string; name: string }[]>;
        error?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: data.error ?? `Could not save linked channels (${res.status})`,
        };
      }
      const norm = data.guildChannels ?? guildChannels;
      setServerUiLinksByBot((prev) => ({ ...prev, [botId]: norm }));
      return { ok: true };
    },
    []
  );

  const refreshBotProfile = useCallback(
    async (botId: string): Promise<RefreshProfileResult> => {
      const res = await apiFetch(`/api/bots/${botId}/profile/refresh`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        return {
          ok: false,
          error: data.error ?? `Could not refresh profile (${res.status})`,
        };
      }
      await refreshBots();
      return { ok: true };
    },
    [refreshBots]
  );

  useEffect(() => {
    if (!user) {
      setBots([]);
      setActiveState(null);
      setServerUiLinksByBot({});
      return;
    }
    void Promise.all([refreshBots(), refreshServerUiLinks()]);
  }, [user, refreshBots, refreshServerUiLinks]);

  useEffect(() => {
    if (!bots.length) return;
    setActiveState((cur) => {
      if (cur && bots.some((b) => b.id === cur)) return cur;
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(ACTIVE_BOT_KEY)
          : null;
      if (saved && bots.some((b) => b.id === saved)) {
        return saved;
      }
      const id = bots[0].id;
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_BOT_KEY, id);
      }
      return id;
    });
  }, [bots]);

  const setActiveBotId = useCallback((id: string) => {
    setActiveState(id);
    localStorage.setItem(ACTIVE_BOT_KEY, id);
  }, []);

  const syncGuilds = useCallback(async (botId: string) => {
    setSyncing(true);
    const postOpts = { timeoutMs: 90_000, quietLog: true } as const;
    try {
      let res = await apiFetch(
        `/api/bots/${botId}/guilds/sync`,
        { method: "POST" },
        postOpts
      );
      if (res.status === 202) {
        return await waitUntilGuildSyncSettles(botId, 900_000);
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 3000));
        res = await apiFetch(
          `/api/bots/${botId}/guilds/sync`,
          { method: "POST" },
          postOpts
        );
      }
      if (res.status === 202) {
        return await waitUntilGuildSyncSettles(botId, 900_000);
      }
      if (res.ok) return { ok: true as const };
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false as const,
        error:
          data.error ??
          `Sync failed (HTTP ${res.status}). A 502 from the host usually means nginx timed out or could not reach the API — check proxy_read_timeout for your API nginx location and that Node matches upstream (see deploy/nginx-api.pearlgrow.com.conf).`,
      };
    } finally {
      setSyncing(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      bots,
      activeBotId,
      setActiveBotId,
      refreshBots,
      deleteBot,
      refreshBotProfile,
      syncing,
      syncGuilds,
      serverUiLinksByBot,
      refreshServerUiLinks,
      saveServerUiLinks,
    }),
    [
      bots,
      activeBotId,
      setActiveBotId,
      refreshBots,
      deleteBot,
      refreshBotProfile,
      syncing,
      syncGuilds,
      serverUiLinksByBot,
      refreshServerUiLinks,
      saveServerUiLinks,
    ]
  );

  return (
    <BotContext.Provider value={value}>{children}</BotContext.Provider>
  );
}

export function useBots() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error("useBots must be inside BotProvider");
  return ctx;
}
