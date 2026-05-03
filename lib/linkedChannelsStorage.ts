/** Matches ServersView / MessagesView localStorage shape. */
export const LINKED_CHANNELS_KEY_PREFIX = "adzz_linked_channels_";

export type LinkedChannelRow = { id: string; name: string; status?: string };

/**
 * Guild id → linked text channels for one bot (browser only).
 */
export function loadLinkedChannelsByGuild(
  botId: string | null
): Record<string, LinkedChannelRow[]> {
  if (!botId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LINKED_CHANNELS_KEY_PREFIX + botId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LinkedChannelRow[]>;
    const out: Record<string, LinkedChannelRow[]> = {};
    for (const [guildId, rows] of Object.entries(parsed)) {
      if (!Array.isArray(rows)) continue;
      out[guildId] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        ...(r.status ? { status: r.status } : {}),
      }));
    }
    return out;
  } catch {
    return {};
  }
}

/** Minimal `{ id, name }` map from legacy localStorage — used once to migrate to the backend. */
export function readLegacyLinkedChannelsMinimal(
  botId: string | null
): Record<string, { id: string; name: string }[]> {
  if (!botId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LINKED_CHANNELS_KEY_PREFIX + botId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LinkedChannelRow[]>;
    const out: Record<string, { id: string; name: string }[]> = {};
    for (const [guildId, rows] of Object.entries(parsed)) {
      if (!Array.isArray(rows)) continue;
      const chans: { id: string; name: string }[] = [];
      for (const r of rows) {
        const id = String(r?.id ?? "").trim();
        if (!id) continue;
        chans.push({
          id,
          name: String(r?.name ?? "").trim() || "channel",
        });
      }
      if (chans.length) out[guildId] = chans;
    }
    return out;
  } catch {
    return {};
  }
}
