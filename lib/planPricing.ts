/** Public support Discord — Robux billing and trial claims are handled via ticket here */
export const SUPPORT_DISCORD_URL = "https://discord.gg/adzz";

export const PLAN_LAUNCH_USD = {
  pro: { now: 6.99, was: 11.99 },
  business: { now: 12.99, was: 18.99 },
} as const;

/** Monthly Robux alternative to USD (same plans) */
export const PLAN_ROBUX_PER_MONTH = {
  pro: 2499,
  business: 2999,
} as const;
