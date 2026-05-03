"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import pack from "./icon-pack.module.css";
import styles from "./user-profile.module.css";

export function SidebarAccount({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const short = user?.email?.split("@")[0] ?? "Account";

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.confirm("Sign out?")) {
      logout();
      window.location.assign("/");
    }
  };

  return (
    <div className={styles.account}>
      <div className={styles.accountTop}>
        <div className={pack.avatarRing} aria-hidden>
          <div className={pack.avatarRingInner}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-mark.png"
              alt=""
              width={40}
              height={40}
              className={styles.brandMarkFill}
            />
          </div>
        </div>
        <div className={styles.accountText}>
          <span className={styles.accountLabel}>My account</span>
          <span className={styles.accountName}>{short}</span>
          <span className={styles.accountEmail} title={user?.email ?? ""}>
            {user?.email ?? "—"}
          </span>
        </div>
      </div>

      <div className={styles.accountDivider} />

      <Link href="/settings" className={styles.accountRow} onClick={() => onNavigate?.()}>
        <Settings size={16} strokeWidth={2} />
        Account settings
      </Link>

      <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
        <LogOut size={16} strokeWidth={2} />
        Log out
      </button>
    </div>
  );
}
