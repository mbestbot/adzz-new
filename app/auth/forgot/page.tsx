"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, Shield, Zap } from "lucide-react";
import { authPublicPost } from "@/lib/api";
import styles from "../auth.module.css";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authPublicPost<{ ok?: boolean; message?: string }>(
        "/api/auth/forgot-password",
        { email: email.trim().toLowerCase() }
      );
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const digits = otp.replace(/\D/g, "").slice(0, 6);
      if (digits.length !== 6) {
        setError("Enter the 6-digit code from your email");
        setBusy(false);
        return;
      }
      const res = await authPublicPost<{ ok?: boolean; resetToken?: string }>(
        "/api/auth/verify-reset-otp",
        { email: email.trim().toLowerCase(), otp: digits }
      );
      if (!res.resetToken) {
        setError("Invalid response from server");
        return;
      }
      setResetToken(res.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const setNewPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetToken) {
      setError("Session expired. Start over from the code step.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await authPublicPost<{ ok?: boolean }>(
        "/api/auth/reset-password-with-token",
        { resetToken, newPassword }
      );
      router.replace("/auth/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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

        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.lead}>
          {step === "email" &&
            "Enter the email for your account. We will send a 6-digit code."}
          {step === "otp" &&
            "Check your inbox for the code, then enter it below."}
          {step === "password" &&
            "Choose a new password. You will be redirected to sign in."}
        </p>

        {error ? <div className={styles.error}>{error}</div> : null}

        {step === "email" ? (
          <form onSubmit={sendCode}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-email">
                Email
              </label>
              <div className={styles.inputWrap}>
                <Mail
                  className={styles.inputIcon}
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="forgot-email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form onSubmit={verifyOtp}>
            <p className={styles.mutedSmall}>
              Sent to <strong>{email}</strong>
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-otp">
                6-digit code
              </label>
              <div className={styles.inputWrap}>
                <KeyRound
                  className={styles.inputIcon}
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="forgot-otp"
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              className={styles.textLinkBtn}
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        ) : null}

        {step === "password" ? (
          <form onSubmit={setNewPass}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-new">
                New password
              </label>
              <div className={styles.inputWrap}>
                <Lock
                  className={styles.inputIcon}
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="forgot-new"
                  className={`${styles.input} ${styles.inputPassword}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
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
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : null}

        <div className={styles.secureRow} style={{ marginTop: "1.25rem" }}>
          <Shield size={14} strokeWidth={2} aria-hidden />
          <span>Codes expire in 15 minutes</span>
        </div>

        <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link href="/auth/login" className={styles.forgotLink}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.5} aria-hidden />
              Back to sign in
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
