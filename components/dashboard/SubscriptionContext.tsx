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

export type SubscriptionTier = "none" | "pro" | "business";

type SubCtx = {
  tier: SubscriptionTier;
  active: boolean;
  subscriptionDaysLeft: number;
  subscriptionDaysTotal: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubCtx | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("none");
  const [active, setActive] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [daysTotal, setDaysTotal] = useState(30);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setTier("none");
      setActive(false);
      setDaysLeft(0);
      setLoading(false);
      return;
    }
    const res = await apiFetch("/api/subscription");
    if (!res.ok) {
      setTier("none");
      setActive(false);
      setDaysLeft(0);
      setLoading(false);
      return;
    }
    const j = (await res.json()) as {
      tier?: string;
      active?: boolean;
      subscriptionDaysLeft?: number;
      subscriptionDaysTotal?: number;
    };
    const t = String(j.tier ?? "").toLowerCase();
    setTier(
      t === "business" || t === "pro" ? (t as SubscriptionTier) : "none"
    );
    setActive(Boolean(j.active));
    setDaysLeft(Math.max(0, Math.floor(Number(j.subscriptionDaysLeft) || 0)));
    setDaysTotal(
      Math.max(1, Math.floor(Number(j.subscriptionDaysTotal) || 30))
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const id = window.setInterval(() => void refresh(), 45000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, refresh]);

  const value = useMemo(
    () => ({
      tier,
      active,
      subscriptionDaysLeft: daysLeft,
      subscriptionDaysTotal: daysTotal,
      loading,
      refresh,
    }),
    [tier, active, daysLeft, daysTotal, loading, refresh]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used inside SubscriptionProvider");
  }
  return ctx;
}
