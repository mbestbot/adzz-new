"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./adminShell.module.css";

const LINKS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/bots", label: "Bots" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <span className={styles.brand}>Adzz Admin</span>
        <span className={styles.badge}>No auth — testing only</span>
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
