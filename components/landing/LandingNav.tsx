"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import styles from "./landing.module.css";

export type LandingNavCurrent = "login" | "signup" | null;

const NAV_BREAK_CLOSE_MS = 760;

export function LandingNav({ current = null }: { current?: LandingNavCurrent }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, close]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= NAV_BREAK_CLOSE_MS) close();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [close]);

  return (
    <header className={styles.nav}>
      {menuOpen ? (
        <button
          type="button"
          className={styles.navBackdrop}
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
        />
      ) : null}
      <div className={styles.navTopRow}>
        <Link href="/" className={styles.brand} onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-mark.png"
            alt=""
            width={36}
            height={36}
            className={styles.brandMark}
            draggable={false}
          />
          Adzz
        </Link>

        <button
          type="button"
          className={styles.navMenuBtn}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="landing-nav-links"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu size={22} strokeWidth={2.25} />
        </button>
      </div>

      <nav
        id="landing-nav-links"
        className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}
        aria-label="Primary"
      >
        <a className={styles.navQuiet} href="/#features" onClick={close}>
          Features
        </a>
        <a className={styles.navQuiet} href="/#get-started" onClick={close}>
          How it works
        </a>
        <a className={styles.navQuiet} href="/#pricing" onClick={close}>
          Pricing
        </a>
        <Link
          href="/auth/login"
          className={`${styles.navGhost} ${current === "login" ? styles.navLinkActive : ""}`}
          onClick={close}
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className={`${styles.navPrimary} ${current === "signup" ? styles.navLinkActive : ""}`}
          onClick={close}
        >
          Sign up
        </Link>
      </nav>
    </header>
  );
}
