export type AdminOverview = {
  totalUsers: number;
  /** Active paid subscribers excluding `excludeFromMrr` ids (same as all when list empty). */
  subscribedUsers: number;
  proPlanActive: number;
  businessPlanActive: number;
  /** All active paid subscribers (ignores exclusions). */
  subscribedUsersAll: number;
  proPlanActiveAll: number;
  businessPlanActiveAll: number;
  mrrUsd: number;
  arrUsd: number;
  mrrUsdAll: number;
  arrUsdAll: number;
  /** Number of id tokens in the exclusion query (may include unknown ids). */
  revenueExclusionCount: number;
  adsPostedToday: number;
  adsPostedThisWeek: number;
  adsPostedThisMonth: number;
  adsPostedTotal: number;
  pricing: { proUsd: number; businessUsd: number };
};
