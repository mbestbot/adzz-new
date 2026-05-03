"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import styles from "./oauthComplete.module.css";

type Props = {
  mode: "loading" | "error";
  title: string;
  description?: string;
  errorText?: string | null;
  /** Extra links shown below the primary action on error (e.g. back to settings). */
  extraActions?: { href: string; label: string }[];
};

export function OAuthCompleteCard({
  mode,
  title,
  description,
  errorText,
  extraActions,
}: Props) {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <span className={styles.brandIcon}>
            <Zap size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <span className={styles.brandName}>Adzz</span>
        </div>

        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.lead}>{description}</p> : null}

        {mode === "loading" ? (
          <>
            <div className={styles.spinnerWrap} aria-hidden>
              <div className={styles.spinner} />
            </div>
            <p className={styles.hint}>
              Securing your session — you will be redirected to the dashboard.
            </p>
          </>
        ) : null}

        {mode === "error" && errorText ? (
          <div className={styles.errorBox} role="alert">
            {errorText}
          </div>
        ) : null}

        {mode === "error" ? (
          <div className={styles.actions}>
            <Link className={styles.linkBtn} href="/auth/login">
              Back to sign in
            </Link>
            {extraActions?.length ? (
              <div className={styles.extraActions}>
                {extraActions.map((a) => (
                  <Link key={a.href} className={styles.linkBtnGhost} href={a.href}>
                    {a.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
