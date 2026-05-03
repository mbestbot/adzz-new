export type AdminUserRow = {
  id: string;
  email: string;
  discordId: string | null;
  createdAt: number | null;
  subscriptionTier: "none" | "pro" | "business";
  subscriptionActive: boolean;
  periodEndMs: number | null;
  botCount: number;
  adsPostedToday: number;
  adsPostedThisWeek: number;
  adsPostedThisMonth: number;
};

export type UsersListResponse = { users: AdminUserRow[] };
