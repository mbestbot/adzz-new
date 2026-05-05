"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Crown,
  CreditCard,
  FileText,
  Home,
  LayoutGrid,
  MessageSquare,
  Server,
} from "lucide-react";
import pack from "./icon-pack.module.css";
import styles from "./sidebar.module.css";
import { SidebarAccount } from "./SidebarAccount";
import { useSubscription } from "./SubscriptionContext";

export type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { subscriptionDaysLeft, subscriptionDaysTotal, active, loading } =
    useSubscription();
  const left = active ? subscriptionDaysLeft : 0;
  const total = Math.max(1, subscriptionDaysTotal);
  const pct = total > 0 ? Math.min(100, Math.round((left / total) * 100)) : 0;

  const close = () => onClose?.();

  return (
    <aside
      id="dash-sidebar"
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
    >
      <SidebarAccount onNavigate={close} />

      <nav className={styles.nav}>
        <Link
          href="/dashboard"
          className={`${styles.navItem} ${pathname === "/dashboard" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <Home size={18} strokeWidth={2} />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/subscriptions"
          className={`${styles.navItem} ${pathname === "/subscriptions" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <CreditCard size={18} strokeWidth={2} />
          <span>Subscriptions</span>
        </Link>

        <div className={styles.navItemDisabled}>
          <BarChart2 size={18} strokeWidth={2} />
          <span>Analytics · Coming Soon</span>
        </div>

        <Link
          href="/servers"
          className={`${styles.navItem} ${pathname === "/servers" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <Server size={18} strokeWidth={2} />
          <span>Servers</span>
        </Link>

        <Link
          href="/promo-servers"
          className={`${styles.navItem} ${pathname === "/promo-servers" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <LayoutGrid size={18} strokeWidth={2} />
          <span>Server discovery</span>
        </Link>

        <Link
          href="/messages"
          className={`${styles.navItem} ${pathname === "/messages" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <MessageSquare size={18} strokeWidth={2} />
          <span>Messages</span>
        </Link>

        <Link
          href="/logs"
          className={`${styles.navItem} ${pathname === "/logs" ? styles.navItemActive : ""}`}
          onClick={close}
        >
          <FileText size={18} strokeWidth={2} />
          <span>Logs</span>
        </Link>
      </nav>

      <div className={styles.footer}>
        <div
          className={`${styles.subCardPack} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
        >
          <div className={styles.subCardHead}>
            <div className={`${pack.iconPack} ${pack.iconPackNeutral} ${pack.iconPackXs}`}>
              <Crown size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <div className={styles.subCardHeadText}>
              <div className={styles.subCardTitle}>Subscription Days Left</div>
              <div
                className={styles.subProgressTrack}
                role="progressbar"
                aria-valuenow={left}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={
                  loading
                    ? "Loading subscription"
                    : `${left} of ${total} days left`
                }
              >
                <div
                  className={styles.subProgressFill}
                  style={{ width: `${pct}%` } as CSSProperties}
                />
              </div>
              <div className={styles.subCardMeta}>
                {loading
                  ? "…"
                  : active
                    ? `${left} / ${total} Days Left`
                    : "No active plan"}
              </div>
            </div>
          </div>
        </div>
        <div
          className={`${styles.footerAvatarNeon} ${pack.iconPack} ${pack.iconPackPurple} ${pack.iconPackXs}`}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-mark.png"
            alt=""
            width={14}
            height={14}
            className={styles.footerBrandMark}
          />
        </div>
      </div>
    </aside>
  );
}
