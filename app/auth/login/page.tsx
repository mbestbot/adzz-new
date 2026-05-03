"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetBanner, setResetBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      setResetBanner(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  if (user) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, remember);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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

        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.lead}>Access your ad engine.</p>

        {resetBanner ? (
          <div
            className={styles.error}
            style={{
              background: "rgba(22, 101, 52, 0.35)",
              borderColor: "rgba(74, 222, 128, 0.35)",
              color: "#bbf7d0",
            }}
          >
            Password updated. Sign in with your new password.
          </div>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Email
            </label>
            <div className={styles.inputWrap}>
              <Mail className={styles.inputIcon} size={18} strokeWidth={2} aria-hidden />
              <input
                id="login-email"
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
            <label className={styles.label} htmlFor="login-pass">
              Password
            </label>
            <div className={styles.inputWrap}>
              <Lock className={styles.inputIcon} size={18} strokeWidth={2} aria-hidden />
              <input
                id="login-pass"
                className={`${styles.input} ${styles.inputPassword}`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

          <div className={`${styles.formActions} ${styles.formActionsBetween}`}>
            <label className={styles.rememberLabel}>
              <input
                type="checkbox"
                className={styles.rememberInput}
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <Link className={styles.forgotLink} href="/auth/forgot">
              Forgot password?
            </Link>
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
              {busy ? "Signing in…" : "Sign in"}
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
          No account? <Link href="/auth/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
