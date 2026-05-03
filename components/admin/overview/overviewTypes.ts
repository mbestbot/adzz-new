export type AdminOverview = {
  totalUsers: number;
  subscribedUsers: number;
  proPlanActive: number;
  businessPlanActive: number;
  mrrUsd: number;
  arrUsd: number;
  adsPostedToday: number;
  adsPostedThisWeek: number;
  adsPostedThisMonth: number;
  adsPostedTotal: number;
  pricing: { proUsd: number; businessUsd: number };
};
