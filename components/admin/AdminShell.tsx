"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAdminToken } from "@/lib/adminToken";
import styles from "./adminShell.module.css";

const LINKS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/bots", label: "Bots" },
  { href: "/admin/potential-clients", label: "Potential clients" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <span className={styles.brand}>Adzz Admin</span>
        <div className={styles.topBarRight}>
          <span className={styles.badge}>Authenticated</span>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => {
              clearAdminToken();
              router.push("/admin/login");
              router.refresh();
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.side}>
          <p className={styles.navLabel}>Navigate</p>
          <ul className={styles.navList}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`${styles.navLink} ${
                    pathname === l.href || pathname?.startsWith(l.href + "/")
                      ? styles.navLinkActive
                      : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}
