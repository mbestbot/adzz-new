"use client";

import Link from "next/link";
import { Crown, KeyRound } from "lucide-react";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { apiFetch } from "@/lib/api";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { discordCdnAvatarUrl } from "@/lib/discordAvatar";
import pack from "./icon-pack.module.css";
import styles from "./account-settings.module.css";

export function AccountSettingsView() {
  const { user, refreshMe } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordMsg, setDiscordMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMsg(null);
      if (newPassword !== confirmPassword) {
        setMsg({ ok: false, text: "New password and confirmation do not match." });
        return;
      }
      setBusy(true);
      try {
        const res = await apiFetch("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
        };
        if (!res.ok) {
          setMsg({
            ok: false,
            text: data.error ?? `Could not update (${res.status})`,
          });
          return;
        }
        setMsg({ ok: true, text: "Password updated." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch {
        setMsg({ ok: false, text: "Something went wrong. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [confirmPassword, currentPassword, newPassword]
  );

  const startDiscordLink = useCallback(async () => {
    setDiscordMsg(null);
    setDiscordBusy(true);
    try {
      const res = await apiFetch("/api/auth/discord/link-intent", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/settings" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!res.ok) {
        setDiscordMsg({
          ok: false,
          text: data.error ?? `Could not start Discord (${res.status})`,
        });
        return;
      }
      if (!data.url) {
        setDiscordMsg({
          ok: false,
          text: "Invalid response from server.",
        });
        return;
      }
      window.location.href = data.url;
    } catch {
      setDiscordMsg({
        ok: false,
        text: "Could not reach the server. Is the API running?",
      });
    } finally {
      setDiscordBusy(false);
    }
  }, []);

  const unlinkDiscord = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Unlink this Discord account from your Adzz profile?")
    ) {
      return;
    }
    setDiscordMsg(null);
    setDiscordBusy(true);
    try {
      const res = await apiFetch("/api/auth/discord/unlink", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDiscordMsg({
          ok: false,
          text: data.error ?? `Could not unlink (${res.status})`,
        });
        return;
      }
      await refreshMe();
      setDiscordMsg({ ok: true, text: "Discord unlinked." });
    } catch {
      setDiscordMsg({ ok: false, text: "Something went wrong. Try again." });
    } finally {
      setDiscordBusy(false);
    }
  }, [refreshMe]);

  const discordLinked = Boolean(user?.discordId);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden />
          Account
        </p>
        <h1 className={styles.title}>Account settings</h1>
        <p className={styles.lead}>
          Your sign-in identity and password for Adzz. Subscription and
          billing period are on the{" "}
          <Link href="/subscriptions" style={{ color: "var(--dash-accent)" }}>
            Subscriptions
          </Link>{" "}
          page.
        </p>
      </header>

      <div className={styles.grid}>
        <section
          className={`${styles.card} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
        >
          <div className={styles.cardHead}>
            <div className={`${pack.iconPack} ${pack.iconPackMuted} ${pack.iconPackXs}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-mark.png"
                alt=""
                width={18}
                height={18}
                className={styles.profileCardBrandMark}
              />
            </div>
            <h2 className={styles.cardTitle}>Profile</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.row}>
              <span className={styles.label}>Email</span>
              <p className={styles.value}>{user?.email ?? "—"}</p>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>User ID</span>
              <p className={`${styles.value} ${styles.mono}`}>{user?.id ?? "—"}</p>
            </div>
            <p className={styles.hint}>
              Email is your login. To change it, contact support or add an
              email-change flow later.
            </p>
          </div>
        </section>

        <section
          className={`${styles.card} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
        >
          <div className={styles.cardHead}>
            <div className={`${pack.iconPack} ${pack.iconPackMuted} ${pack.iconPackXs}`}>
              <DiscordIcon size={18} />
            </div>
            <h2 className={styles.cardTitle}>Discord</h2>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.hint} style={{ marginTop: 0 }}>
              Link your Discord profile to your Adzz account. You can still sign
              in with email and password.
            </p>
            {discordLinked && user?.discordId ? (
              <div className={styles.discordLinked}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.discordAvatar}
                  src={discordCdnAvatarUrl(
                    user.discordId,
                    user.discordAvatar ?? null,
                    88
                  )}
                  alt=""
                  width={44}
                  height={44}
                />
                <div className={styles.discordMeta}>
                  <p className={styles.discordName}>
                    {user.discordUsername ?? "Discord user"}
                  </p>
                  <p className={styles.discordIdLine} title="Discord user ID">
                    {user.discordId}
                  </p>
                </div>
              </div>
            ) : (
              <p className={styles.value} style={{ margin: 0 }}>
                Not linked
              </p>
            )}
            {discordMsg ? (
              <p
                className={discordMsg.ok ? styles.bannerOk : styles.bannerErr}
                role={discordMsg.ok ? "status" : "alert"}
              >
                {discordMsg.text}
              </p>
            ) : null}
            <div className={styles.discordActions}>
              {discordLinked ? (
                <button
                  type="button"
                  className={styles.discordBtn}
                  disabled={discordBusy}
                  onClick={startDiscordLink}
                >
                  <DiscordIcon size={18} />
                  {discordBusy ? "Redirecting…" : "Replace linked account"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.discordBtn}
                  disabled={discordBusy}
                  onClick={startDiscordLink}
                >
                  <DiscordIcon size={18} />
                  {discordBusy ? "Redirecting…" : "Link Discord account"}
                </button>
              )}
              {discordLinked ? (
                <button
                  type="button"
                  className={styles.discordUnlink}
                  disabled={discordBusy}
                  onClick={unlinkDiscord}
                >
                  Unlink
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className={`${styles.card} ${pack.kpiCardPack} ${pack.kpiCardPackPurple}`}
        >
          <div className={styles.cardHead}>
            <div className={`${pack.iconPack} ${pack.iconPackPurple} ${pack.iconPackXs}`}>
              <KeyRound size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className={styles.cardTitle}>Security</h2>
          </div>
          <div className={styles.cardBody}>
            <form onSubmit={onSubmit}>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="current-password">
                  Current password
                </label>
                <input
                  id="current-password"
                  className={styles.input}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="confirm-password">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {msg ? (
                <p
                  className={msg.ok ? styles.bannerOk : styles.bannerErr}
                  role={msg.ok ? "status" : "alert"}
                >
                  {msg.text}
                </p>
              ) : null}
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        </section>

        <section
          className={`${styles.card} ${pack.kpiCardPack} ${pack.kpiCardPackNeutral}`}
        >
          <div className={styles.linkRow}>
            <div>
              <div className={styles.cardHead} style={{ marginBottom: "0.35rem" }}>
                <div className={`${pack.iconPack} ${pack.iconPackNeutral} ${pack.iconPackXs}`}>
                  <Crown size={16} strokeWidth={1.75} aria-hidden />
                </div>
                <h2 className={styles.cardTitle}>Plan &amp; renewal</h2>
              </div>
              <p className={styles.hint} style={{ margin: 0 }}>
                View days remaining in your billing window and cycle length.
              </p>
            </div>
            <Link href="/subscriptions" className={styles.linkBtn}>
              Open subscriptions
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
