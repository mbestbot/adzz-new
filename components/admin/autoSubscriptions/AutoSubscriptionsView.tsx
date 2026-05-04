"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  adminDeleteJson,
  adminGetJson,
  adminPostJson,
} from "@/lib/adminApi";
import botStyles from "../bots/bots.module.css";
import styles from "./autoSubscriptions.module.css";

export type AutoSubRule = {
  id: string;
  email: string | null;
  discordId: string | null;
  tier: "pro" | "business";
  days: number;
  note: string;
  createdAt: number;
};

type RulesResponse = { rules: AutoSubRule[] };

export function AutoSubscriptionsView() {
  const [rules, setRules] = useState<AutoSubRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [tier, setTier] = useState<"pro" | "business">("pro");
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    setError(null);
    return adminGetJson<RulesResponse>("/api/admin/auto-subscriptions").then(
      (d) => setRules(d.rules)
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addRule = useCallback(async () => {
    const em = email.trim().toLowerCase();
    const did = discordId.trim();
    if (!em && !did) {
      setError("Enter an email and/or a Discord user ID.");
      return;
    }
    const d = Math.max(1, Math.min(3650, Math.floor(Number(days) || 30)));
    setBusy(true);
    setError(null);
    try {
      const out = await adminPostJson<RulesResponse>(
        "/api/admin/auto-subscriptions",
        {
          email: em || undefined,
          discordId: did || undefined,
          tier,
          days: d,
          note: note.trim(),
        }
      );
      setRules(out.rules);
      setEmail("");
      setDiscordId("");
      setNote("");
      setDays(String(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }, [email, discordId, tier, days, note]);

  const removeRule = useCallback(async (id: string) => {
    if (!window.confirm("Remove this auto-subscription rule?")) return;
    setBusy(true);
    setError(null);
    try {
      const out = await adminDeleteJson<RulesResponse>(
        `/api/admin/auto-subscriptions/${encodeURIComponent(id)}`
      );
      setRules(out.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }, []);

  if (error && !rules) {
    return <div className={botStyles.error}>{error}</div>;
  }

  if (!rules) {
    return <p className={botStyles.muted}>Loading…</p>;
  }

  return (
    <div className={styles.wrap}>
      {error ? <div className={botStyles.error}>{error}</div> : null}

      <section className={styles.card} aria-labelledby="auto-sub-add-title">
        <h2 id="auto-sub-add-title" className={styles.cardTitle}>
          Add rule
        </h2>
        <p className={styles.cardLead}>
          When someone signs up (email or Discord) or links Discord, if they match
          a rule they get the plan once. Leave email blank for Discord-only match,
          or Discord blank for email-only. If both are set,{" "}
          <strong>both</strong> must match the account.
        </p>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Email (optional)
            <input
              className={styles.input}
              type="email"
              autoComplete="off"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className={styles.label}>
            Discord user ID (optional)
            <input
              className={styles.input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 123456789012345678"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className={styles.label}>
            Plan
            <select
              className={styles.input}
              value={tier}
              onChange={(e) =>
                setTier(e.target.value === "business" ? "business" : "pro")
              }
              disabled={busy}
            >
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className={styles.label}>
            Days
            <input
              className={styles.input}
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className={`${styles.label} ${styles.labelWide}`}>
            Note (optional)
            <input
              className={styles.input}
              type="text"
              placeholder="Internal note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          disabled={busy}
          onClick={() => void addRule()}
        >
          Add to list
        </button>
      </section>

      <section className={styles.card} aria-label="Auto-subscription rules">
        <h2 className={styles.cardTitle}>Rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <p className={botStyles.muted}>No rules yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Discord ID</th>
                  <th>Plan</th>
                  <th>Days</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email ?? "—"}</td>
                    <td className={styles.mono}>{r.discordId ?? "—"}</td>
                    <td>{r.tier}</td>
                    <td>{r.days}</td>
                    <td className={styles.noteCell}>{r.note || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.delBtn}
                        disabled={busy}
                        aria-label="Remove rule"
                        onClick={() => void removeRule(r.id)}
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
