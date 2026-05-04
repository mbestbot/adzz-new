"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BarChart2,
  Bot,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  Server,
  Target,
  Timer,
  Wrench,
  Zap,
} from "lucide-react";
import {
  PLAN_LAUNCH_USD,
  PLAN_ROBUX_PER_MONTH,
  SUPPORT_DISCORD_URL,
} from "@/lib/planPricing";
import styles from "./landing.module.css";
import { LandingNav } from "./LandingNav";

const FEATURES = [
  {
    title: "Unlimited Ad Bots creation",
    desc: "Spin up as many automation bots as your workflow needs — no artificial caps.",
    icon: Bot,
  },
  {
    title: "100 servers per bot",
    desc: "Each bot can join up to a hundred Discord servers with stable, isolated configs.",
    icon: Server,
  },
  {
    title: "Detailed analytics",
    desc: "Track performance and tune what matters with clear, dashboard-ready metrics.",
    icon: BarChart2,
  },
  {
    title: "Ad Pool",
    desc: "Queue and rotate creatives so your promotions stay fresh without manual babysitting.",
    icon: LayoutGrid,
  },
  {
    title: "Campaign Creation",
    desc: "Plan bursts and structured pushes without breaking your day-to-day posting rhythm.",
    icon: Target,
  },
  {
    title: "Bot Maintenance",
    desc: "Health-focused tooling so your automation stays online when channels get busy.",
    icon: Wrench,
  },
  {
    title: "Custom msg per server/Channel",
    desc: "Tailor copy per guild or channel so every community hears the right message.",
    icon: MessageSquare,
  },
  {
    title: "5 sec minimum Cooldown",
    desc: "Stay respectful and compliant with a sane minimum gap between posts.",
    icon: Timer,
  },
  {
    title: "Multi Channel support",
    desc: "Broadcast across multiple channels without duplicating bot setup for each one.",
    icon: GitBranch,
  },
] as const;

/** Full composite cards per feature title; bump rev when replacing PNGs. */
const FEATURE_CARD_IMAGE_REV = "4";
const FEATURE_SPOTLIGHT_IMAGE_BY_TITLE: Record<string, string> = {
  "Unlimited Ad Bots creation": `/icons/features/unlimited-ad-bots-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "100 servers per bot": `/icons/features/100-servers-per-bot-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Detailed analytics": `/icons/features/detailed-analytics-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Ad Pool": `/icons/features/ad-pool-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Campaign Creation": `/icons/features/campaign-creation-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Bot Maintenance": `/icons/features/bot-maintenance-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Custom msg per server/Channel": `/icons/features/custom-msg-per-server-channel-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "5 sec minimum Cooldown": `/icons/features/5-sec-minimum-cooldown-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
  "Multi Channel support": `/icons/features/multi-channel-support-card.png?v=${FEATURE_CARD_IMAGE_REV}`,
};

const SHARED_FEATURES = [
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

const BUSINESS_EXTRA = [
  "Campaign to send a certain amount of ads",
  "Instant roll back to normal posting after campaign quota ends",
] as const;

/** Bust caches when swapping PNGs under `public/icons/journey/`. */
const JOURNEY_ICONS_REV = "10";
const journeyPng = (slug: string) =>
  `/icons/journey/${slug}.png?v=${JOURNEY_ICONS_REV}`;

const JOURNEY_STEPS = [
  {
    title: "Active plan",
    desc: "Subscribe to Adzz Pro or Business — your dashboard unlocks as soon as checkout completes.",
    imageSrc: journeyPng("active-plan"),
  },
  {
    title: "Create account",
    desc: "Sign up with your email, sign in, and jump straight into Servers or Messages.",
    imageSrc: journeyPng("create-account"),
  },
  {
    title: "Verify phone",
    desc: "Complete phone verification when prompted. We surface OTP & phone number.",
    imageSrc: journeyPng("verify-phone"),
  },
  {
    title: "Input token",
    desc: "Paste your Discord bot token into Adzz — it stays on the server so posting can run around the clock.",
    imageSrc: journeyPng("input-token"),
  },
  {
    title: "Start posting",
    desc: "Link channels, set copy and cooldowns, then enable campaigns or your ad pool — you’re live.",
    imageSrc: journeyPng("start-posting"),
  },
] as const;

export function LandingPage() {
  return (
    <div
      className={styles.page}
      onDragStart={(e) => {
        if ((e.target as HTMLElement).tagName === "IMG") e.preventDefault();
      }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).tagName === "IMG") e.preventDefault();
      }}
    >
      <div className={styles.gradientBg} aria-hidden />
      <div className={styles.inner}>
        <LandingNav />

        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroRow}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Discord ad automation</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                <span className={styles.heroTitleLine}>
                  <span className={styles.pricingTitlePlain}>Automate </span>
                  <span className={styles.pricingTitleAccentWrap}>
                    <span className={styles.pricingTitleAccent}>
                      Discord Ads
                    </span>
                  </span>
                </span>
                <span className={styles.heroTitleLine}>
                  <span className={styles.pricingTitlePlain}>With </span>
                  <span className={styles.pricingTitleAccentWrap}>
                    <span className={styles.pricingTitleAccent}>Adzz</span>
                  </span>
                </span>
              </h1>
              <p className={styles.heroLead}>
                Adzz helps teams run structured promotional messaging across
                servers and channels with campaigns, ad pools, and analytics
                built for scale.
              </p>
              <div className={styles.heroCtas}>
                <Link className={styles.navPrimary} href="/auth/signup">
                  Sign up
                </Link>
                <Link className={styles.navGhost} href="/auth/login">
                  Sign in
                </Link>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.heroImageWrap}>
                <div className={styles.heroImageInner}>
                  <Image
                    src="/hero-dashboard.png?v=1"
                    alt="Adzz dashboard showing server and channel control, stats, and subscription days left"
                    width={1024}
                    height={682}
                    className={styles.heroImage}
                    priority
                    draggable={false}
                    sizes="(max-width: 900px) min(100vw, 520px), (max-width: 1240px) 52vw, 640px"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className={styles.section}
          aria-labelledby="features-heading"
        >
          <div className={styles.pricingHead}>
            <p className={styles.pricingEyebrow}>Features</p>
            <div className={styles.featuresTitle}>
              <h2 id="features-heading" className={styles.pricingTitle}>
                <span className={styles.pricingTitlePlain}>
                  Everything you need to{" "}
                </span>
                <span className={styles.pricingTitleAccentWrap}>
                  <span className={styles.pricingTitleAccent}>
                    run ads at scale
                  </span>
                </span>
              </h2>
            </div>
            <p className={styles.pricingLead}>
              Built for operators who want reliability in the dashboard and
              flexibility in every channel.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              const spotlightSrc = FEATURE_SPOTLIGHT_IMAGE_BY_TITLE[f.title];
              if (spotlightSrc) {
                return (
                  <article
                    key={f.title}
                    className={styles.featureCardSpotlight}
                  >
                    <Image
                      src={spotlightSrc}
                      alt={`${f.title}. ${f.desc}`}
                      width={800}
                      height={680}
                      className={styles.featureCardSpotlightImg}
                      draggable={false}
                      sizes="(max-width: 560px) min(100vw, 26rem), (max-width: 900px) min(100vw, 24rem), min(100vw, 22rem)"
                      unoptimized
                    />
                  </article>
                );
              }
              return (
                <article key={f.title} className={styles.featureCard}>
                  <div className={styles.featureIcon}>
                    <Icon size={22} strokeWidth={1.85} aria-hidden />
                  </div>
                  <div className={styles.featureBody}>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <p className={styles.featureDesc}>{f.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="get-started"
          className={styles.journeySection}
          aria-labelledby="journey-title"
        >
          <div className={styles.pricingHead}>
            <p className={styles.pricingEyebrow}>
              <Zap size={14} strokeWidth={2.25} aria-hidden />
              Get started
            </p>
            <h2 id="journey-title" className={styles.pricingTitle}>
              <span className={styles.pricingTitlePlain}>How to get </span>
              <span className={styles.pricingTitleAccentWrap}>
                <span className={styles.pricingTitleAccent}>started</span>
              </span>
            </h2>
            <p className={styles.pricingLead}>
              Get your ads live in just a few simple steps.
            </p>
          </div>
          <div className={styles.journeySteps} role="list">
            {JOURNEY_STEPS.map((step) => (
              <article
                key={step.title}
                className={styles.journeyCard}
                role="listitem"
              >
                <div className={styles.journeyIconSlot}>
                  <Image
                    src={step.imageSrc}
                    alt={step.title}
                    width={256}
                    height={256}
                    className={styles.journeyStepImg}
                    draggable={false}
                    sizes="(max-width: 560px) 55vw, 200px"
                    unoptimized
                  />
                </div>
                <h3 className={styles.journeyStepTitle}>{step.title}</h3>
                <p className={styles.journeyStepDesc}>{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className={styles.section}
          aria-labelledby="pricing-heading"
        >
          <div className={styles.pricingHead}>
            <p className={styles.pricingEyebrow}>Pricing</p>
            <h2 id="pricing-heading" className={styles.pricingTitle}>
              <span className={styles.pricingTitlePlain}>Simple </span>
              <span className={styles.pricingTitleAccentWrap}>
                <span className={styles.pricingTitleAccent}>launch</span>
              </span>
              <span className={styles.pricingTitlePlain}> pricing</span>
            </h2>
            <p className={styles.pricingLead}>
              Two plans — both include the full core platform. Business adds
              campaign quota controls for high-volume teams. Pay in{" "}
              <strong>USD</strong> (card via Stripe) or <strong>Robux</strong>{" "}
              (see each card). Robux purchases are handled in Discord — open a
              ticket in our server after you join.
            </p>
          </div>
          <div className={styles.pricingRow}>
            <div className={styles.pricingSide} aria-hidden>
              <Image
                src="/icons/pricing-rocket.png?v=1"
                alt=""
                width={427}
                height={584}
                className={styles.pricingSideImg}
                draggable={false}
                sizes="(max-width: 1099px) 0px, 520px"
                unoptimized
              />
            </div>
            <div className={styles.pricingCenter}>
              <div className={styles.pricingGrid}>
            <article className={styles.planCard}>
              <h3 className={styles.planName}>Adzz Pro</h3>
              <div className={styles.priceRow}>
                <span className={styles.priceWas}>
                  ${PLAN_LAUNCH_USD.pro.was.toFixed(2)}
                </span>
                <span className={styles.priceNow}>
                  ${PLAN_LAUNCH_USD.pro.now.toFixed(2)}
                </span>
                <span className={styles.pricePeriod}>/ month</span>
                <span className={styles.launchTag}>Launch offer</span>
                <span className={styles.priceNote}>
                  or{" "}
                  <strong>
                    {PLAN_ROBUX_PER_MONTH.pro.toLocaleString()} Robux
                  </strong>{" "}
                  / month
                </span>
              </div>
              <p className={styles.planLead}>
                Full access to bots, servers, analytics, ad pool, campaigns, and
                multi-channel messaging.
              </p>
              <ul className={styles.planList}>
                {SHARED_FEATURES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className={`${styles.planCta} ${styles.planCtaSecondary}`}
              >
                Create account
              </Link>
            </article>

            <article
              className={`${styles.planCard} ${styles.planCardFeatured}`}
            >
              <span className={styles.planBadge}>Most flexible</span>
              <h3 className={styles.planName}>Adzz Business</h3>
              <div className={styles.priceRow}>
                <span className={styles.priceWas}>
                  ${PLAN_LAUNCH_USD.business.was.toFixed(2)}
                </span>
                <span className={styles.priceNow}>
                  ${PLAN_LAUNCH_USD.business.now.toFixed(2)}
                </span>
                <span className={styles.pricePeriod}>/ month</span>
                <span className={styles.launchTag}>Launch offer</span>
                <span className={styles.priceNote}>
                  or{" "}
                  <strong>
                    {PLAN_ROBUX_PER_MONTH.business.toLocaleString()} Robux
                  </strong>{" "}
                  / month
                </span>
              </div>
              <p className={styles.planLead}>
                Everything in Pro, plus advanced campaign targeting and automatic
                recovery when quotas complete.
              </p>
              <ul className={`${styles.planList} ${styles.planListHighlight}`}>
                {BUSINESS_EXTRA.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {SHARED_FEATURES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link href="/auth/signup" className={styles.planCta}>
                Create account
              </Link>
            </article>
              </div>
            </div>
          </div>
          <p
            className={styles.sectionLead}
            style={{ marginTop: "1.5rem", marginBottom: 0 }}
          >
            <strong>USD:</strong> subscribe from the app after you sign in — Stripe
            handles card billing. <strong>Robux:</strong> join{" "}
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              our Discord
            </a>{" "}
            and open a support ticket to purchase your plan with Robux.
          </p>
        </section>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Adzz</span>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Support server
            </a>
            <Link href="/auth/login">Sign in</Link>
            <Link href="/auth/signup">Sign up</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
