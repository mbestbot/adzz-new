"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getAdminToken, setAdminToken } from "@/lib/adminToken";
import styles from "./adminLogin.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@adzz.pro");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getAdminToken()) router.replace("/admin/overview");
  }, [router]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          token?: string;
        };
        if (!res.ok) {
          setError(data.error ?? `Login failed (${res.status})`);
          return;
        }
        if (!data.token) {
          setError("Invalid response from server.");
          return;
        }
        setAdminToken(data.token);
        router.replace("/admin/overview");
        router.refresh();
      } catch {
        setError("Could not reach the API.");
      } finally {
        setBusy(false);
      }
    },
    [email, password, router]
  );

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Adzz admin</h1>
      <p className={styles.lead}>Sign in with the operator account.</p>
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p className={styles.err} role="alert">
            {error}
          </p>
        ) : null}
        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
