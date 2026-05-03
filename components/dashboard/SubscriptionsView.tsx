"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSubscription } from "@/components/dashboard/SubscriptionContext";
import pack from "./icon-pack.module.css";
import styles from "./subscriptions.module.css";

type DashboardSub = {
  subscriptionDaysLeft: number;
  subscriptionDaysTotal: number;
};

type CheckoutPlan = "pro" | "business";

const SHARED_PLAN_FEATURES = [
  "Unlimited Ad Bots creation",
  "100 servers per bot",
  "Detailed analytics",
  "Ad Pool",
  "Campaign Creation",
  "Bot Maintenance",
  "Custom msg per server/Channel",
  "5 sec minimum Cooldown",
  "Multi Channel support",
] as const;

const BUSINESS_HIGHLIGHT_FEATURES = [
  "Campaign to send a certain amount of ads",
  "Instant roll back to normal posting after campaign quota ends",
] as const;

export function SubscriptionsView() {
  const { refresh: refreshSubscription, tier, active, loading: subscriptionLoading } =
    useSubscription();
  const [data, setData] = useState<DashboardSub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutNotice, setCheckoutNotice] = useState<
    "success" | "canceled" | null
  >(null);
  const [checkoutBusy, setCheckoutBusy] = useState<CheckoutPlan | null>(null);
  const [syncHint, setSyncHint] = useState<string | null>(null);

  const startCheckout = useCallback(async (plan: CheckoutPlan) => {
    setCheckoutBusy(plan);
    try {
      const res = await apiFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        window.alert(data.error ?? `Checkout failed (${res.status})`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      window.alert("Checkout did not return a redirect URL.");
    } finally {
      setCheckoutBusy(null);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/dashboard");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Could not load (${res.status})`);
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as DashboardSub;
    setData({
      subscriptionDaysLeft: Math.max(
        0,
        Math.floor(Number(json.subscriptionDaysLeft) || 0)
      ),
      subscriptionDaysTotal: Math.max(
        1,
        Math.floor(Number(json.subscriptionDaysTotal) || 1)
      ),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const checkout = p.get("checkout");
    const sessionId = p.get("session_id");

    if (checkout === "canceled") {
      setCheckoutNotice("canceled");
      return;
    }
    if (checkout !== "success") return;

    setCheckoutNotice("success");
    setSyncHint(null);

    void (async () => {
      if (sessionId) {
        const res = await apiFetch("/api/stripe/sync-checkout-session", {
          method: "POST",
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setSyncHint(
            body.error ??
              "Could not confirm your subscription with the server. Try Refresh, or ensure Stripe webhooks reach your API for renewals."
          );
        }
      }
      await refreshSubscription();
      await load();
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      const qs = url.searchParams.toString();
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${qs ? `?${qs}` : ""}`
      );
    })();
  }, [refreshSubscription, load]);

  const left = data?.subscriptionDaysLeft ?? 0;
  const total = data?.subscriptionDaysTotal ?? 28;
  const pct =
    total > 0 ? Math.min(100, Math.round((left / total) * 100)) : 0;

  const isProCurrent = !subscriptionLoading && active && tier === "pro";
  const isBusinessCurrent = !subscriptionLoading && active && tier === "business";
  const canUpgradeToBusiness =
    !subscriptionLoading && active && tier === "pro" && !isBusinessCurrent;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Billing
          </p>
          <h1 className={styles.title}>Subscriptions</h1>
          <p className={styles.lead}>
            Subscribe with Stripe (test mode). Launch pricing is billed monthly.
            After checkout, your plan updates here automatically; Stripe webhooks
            on your API URL still handle renewals and cancellations.
          </p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {checkoutNotice === "success" ? (
        <p className={styles.checkoutBannerOk} role="status">
          Checkout completed in Stripe. Test subscriptions appear in the Stripe
          Dashboard under Customers / Subscriptions.
        </p>
      ) : null}
      {syncHint ? (
        <p className={styles.checkoutBannerMuted} role="status">
          {syncHint}
        </p>
      ) : null}
      {checkoutNotice === "canceled" ? (
        <p className={styles.checkoutBannerMuted} role="status">
          Checkout was canceled. You can choose a plan again when you&apos;re
          ready.
        </p>
      ) : null}

      {error ? (
        <p className={styles.bannerErr} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.plansSection} aria-labelledby="plans-heading">
        <h2 id="plans-heading" className={styles.plansSectionTitle}>
          Plans
        </h2>
        <div className={styles.plansGrid}>
          <div className={styles.planCard}>
            <div className={styles.planCardHead}>
              <h3 className={styles.planCardName}>Adzz Pro</h3>
              <div className={styles.priceBlock}>
                <span className={styles.priceWas}>$11.99</span>
                <span className={styles.priceNow}>$6.99</span>
                <span className={styles.launchTag}>Launch offer</span>
              </div>
              <p className={styles.whatsIncluded}>What&apos;s included</p>
              <ul className={styles.featureList}>
                {SHARED_PLAN_FEATURES.map((line) => (
                  <li key={line} className={styles.featureItem}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              className={`${styles.planCta} ${
                isProCurrent ? styles.planCtaCurrent : styles.planCtaReady
              }`}
              disabled={
                checkoutBusy !== null ||
                subscriptionLoading ||
                isProCurrent
              }
              onClick={() => void startCheckout("pro")}
            >
              {subscriptionLoading
                ? "Checking plan…"
                : checkoutBusy === "pro"
                  ? "Redirecting…"
                  : isProCurrent
                    ? "Current subscription"
                    : "Subscribe · Pro"}
            </button>
          </div>

          <div
            className={`${styles.planCard} ${styles.planCardBusiness}`}
          >
            <div className={styles.planCardHead}>
              <h3 className={styles.planCardName}>Adzz Business</h3>
              <div className={styles.priceBlock}>
                <span className={styles.priceWas}>$18.99</span>
                <span className={styles.priceNow}>$12.99</span>
                <span className={styles.launchTag}>Launch offer</span>
              </div>
              <p className={styles.whatsIncluded}>What&apos;s included</p>
              <ul className={styles.featureList}>
                {BUSINESS_HIGHLIGHT_FEATURES.map((line) => (
                  <li
                    key={line}
                    className={`${styles.featureItem} ${styles.featureItemHighlight}`}
                  >
                    {line}
                  </li>
                ))}
                {SHARED_PLAN_FEATURES.map((line) => (
                  <li key={line} className={styles.featureItem}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              className={`${styles.planCta} ${
                isBusinessCurrent ? styles.planCtaCurrent : styles.planCtaReady
              }`}
              disabled={
                checkoutBusy !== null ||
                subscriptionLoading ||
                isBusinessCurrent
              }
              onClick={() => void startCheckout("business")}
            >
              {subscriptionLoading
                ? "Checking plan…"
                : checkoutBusy === "business"
                  ? "Redirecting…"
                  : isBusinessCurrent
                    ? "Current subscription"
                    : canUpgradeToBusiness
                      ? "Upgrade · Business"
                      : "Subscribe · Business"}
            </button>
          </div>
        </div>
      </section>

      <section
        className={`${styles.hero} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
      >
        <div className={styles.heroTop}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div className={`${pack.iconPack} ${pack.iconPackNeutral} ${pack.iconPackSm}`}>
              <Crown size={20} strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h2 className={styles.planName}>Adzz access</h2>
              <p className={styles.planMeta}>
                Configured billing window · renew when days left reaches zero
              </p>
            </div>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Days left</span>
            <p className={styles.statValue}>
              {loading ? "…" : left.toLocaleString()}
            </p>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Cycle length</span>
            <p className={styles.statValue}>
              {loading ? "…" : `${total.toLocaleString()} days`}
            </p>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Remaining</span>
            <p className={styles.statValue}>{loading ? "…" : `${pct}%`}</p>
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={left}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${left} of ${total} days left`}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${pct}%` } as CSSProperties}
            />
          </div>
          <p className={styles.progressCaption}>
            {loading
              ? "Loading subscription window…"
              : `${left.toLocaleString()} of ${total.toLocaleString()} days left in this period`}
          </p>
        </div>
      </section>

      <p className={styles.note}>
        <strong>Stripe.</strong> Configure{" "}
        <code style={{ fontSize: "0.8em" }}>STRIPE_SECRET_KEY</code> and{" "}
        <code style={{ fontSize: "0.8em" }}>FRONTEND_ORIGIN</code> on the API
        host (see <code style={{ fontSize: "0.8em" }}>backend/.env.example</code>
        ). Optional <code style={{ fontSize: "0.8em" }}>STRIPE_WEBHOOK_SECRET</code>{" "}
        for subscription events. Frontend:{" "}
        <code style={{ fontSize: "0.8em" }}>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
        in <code style={{ fontSize: "0.8em" }}>.env.local</code> for future
        client-side Stripe.js (Checkout redirect works without it). Other env:{" "}
        <code style={{ fontSize: "0.8em" }}>SUBSCRIPTION_DAYS_LEFT</code> /{" "}
        <code style={{ fontSize: "0.8em" }}>SUBSCRIPTION_DAYS_TOTAL</code>. Update
        security on{" "}
        <Link href="/settings" className={styles.linkInline}>
          Account settings
        </Link>
        .
      </p>
    </div>
  );
}
