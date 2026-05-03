"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { API_BASE } from "@/lib/api";
import styles from "../auth.module.css";

export default function SignupPage() {
  const { signup, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  if (user) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signup(email, password, remember);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <span className={styles.brandIcon}>
            <Zap size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <span className={styles.brandName}>Adzz</span>
        </div>

        <h1 className={styles.title}>Create your account.</h1>
        <p className={styles.lead}>
          Join Adzz and start automating Discord ads from one dashboard.
        </p>

        {error ? <div className={styles.error}>{error}</div> : null}

        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="su-email">
              Email
            </label>
            <div className={styles.inputWrap}>
              <Mail className={styles.inputIcon} size={18} strokeWidth={2} aria-hidden />
              <input
                id="su-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="su-pass">
              Password
            </label>
            <div className={styles.inputWrap}>
              <Lock className={styles.inputIcon} size={18} strokeWidth={2} aria-hidden />
              <input
                id="su-pass"
                className={`${styles.input} ${styles.inputPassword}`}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Choose a password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className={styles.togglePass}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={2} />
                ) : (
                  <Eye size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div className={styles.formActions}>
            <label className={styles.rememberLabel}>
              <input
                type="checkbox"
                className={styles.rememberInput}
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me on this device
            </label>
          </div>

          <button type="submit" className={styles.submit} disabled={busy}>
            <span className={styles.submitInner}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/auth-navbar-rocket.png"
                alt=""
                width={34}
                height={34}
                className={styles.submitRocket}
                draggable={false}
              />
              {busy ? "Creating…" : "Sign up"}
            </span>
          </button>
        </form>

        <div className={styles.divider}>or continue with</div>

        <div className={styles.socialRow}>
          <a
            className={`${styles.socialBtn} ${styles.socialDiscord}`}
            href={`${API_BASE}/api/auth/discord`}
          >
            <DiscordIcon className={styles.discordGlyph} size={26} />
            Discord
          </a>
          <button
            type="button"
            className={styles.socialBtn}
            disabled
            title="Google sign-in is not available yet"
          >
            <GoogleIcon />
            Google
          </button>
        </div>

        <div className={styles.secureRow}>
          <Shield size={14} strokeWidth={2} aria-hidden />
          <span>Your data is secure and encrypted</span>
        </div>

        <p className={styles.footer}>
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
