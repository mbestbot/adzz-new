"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useSubscription } from "./SubscriptionContext";
import styles from "./shell.module.css";

/** Paths that stay usable without an active Pro/Business subscription */
const ALLOWED_WITHOUT_SUB = new Set(["/settings", "/subscriptions"]);

function mobileHeaderTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/servers")) return "Servers";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/logs")) return "Logs";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/subscriptions")) return "Plans";
  if (pathname.startsWith("/generate-email")) return "Test email";
  return "Adzz";
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { active, loading } = useSubscription();
  const [navOpen, setNavOpen] = useState(false);

  const locked =
    !loading && !active && !ALLOWED_WITHOUT_SUB.has(pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!locked && !navOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [locked, navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className={styles.shell}>
      {navOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <button
            type="button"
            className={styles.mobileNavToggle}
            aria-expanded={navOpen}
            aria-controls="dash-sidebar"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Menu size={22} strokeWidth={2} aria-hidden />
          </button>
          <span className={styles.mobileHeaderTitle}>
            {mobileHeaderTitle(pathname)}
          </span>
        </header>
        <div className={styles.mainBody}>
          <div
            className={
              locked ? `${styles.mainInner} ${styles.mainInnerLocked}` : styles.mainInner
            }
          >
            {children}
          </div>
          {locked ? (
            <div className={styles.subscriptionLockOverlay}>
              <div className={styles.subscriptionLockCard}>
                <p className={styles.subscriptionLockTitle}>
                  Subscription required
                </p>
                <p className={styles.subscriptionLockDesc}>
                  You need an <strong>Adzz Pro</strong> or{" "}
                  <strong>Adzz Business</strong> plan to use the dashboard. Your
                  bots, channels, and campaigns stay saved — subscribe again and
                  everything resumes right away.
                </p>
                <div className={styles.subscriptionLockActions}>
                  <Link href="/subscriptions" className={styles.subscriptionLockCta}>
                    View plans
                  </Link>
                  <Link
                    href="/settings"
                    className={styles.subscriptionLockSecondary}
                  >
                    Account settings
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
