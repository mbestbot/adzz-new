export type AdminBotRow = {
  id: string;
  userId: string;
  ownerEmail: string;
  displayName: string;
  username: string;
  discordUserId: string;
  tokenType: string;
  createdAt: number | null;
  egressMode: "direct" | "proxy";
  egressHostPort: string | null;
  egressSlotIndex: number | null;
  adsPostedTotal: number;
};

export type AdminBotsListResponse = { bots: AdminBotRow[] };

export type AdminBotDetail = {
  id: string;
  userId: string;
  ownerEmail: string;
  displayName: string;
  username: string;
  discordUserId: string;
  tokenType: string;
  createdAt: number | null;
  accountEmail: string | null;
  accountPassword: string | null;
  token: string;
};

export type AdminBotDetailResponse = { bot: AdminBotDetail };

export type AdminBotPatchResponse = { ok: boolean; bot: AdminBotDetail | null };
