"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGetJson } from "@/lib/adminApi";
import type { AdminUserRow, UsersListResponse } from "./adminUserTypes";
import { UserRowActions } from "./UserRowActions";
import styles from "./users.module.css";

function tierClass(t: AdminUserRow["subscriptionTier"]) {
  if (t === "business") return styles.pillBus;
  if (t === "pro") return styles.pillPro;
  return styles.pillNone;
}

function formatDate(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export function UsersView() {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return adminGetJson<UsersListResponse>("/api/admin/users").then((d) => {
      setRows(d.users);
    });
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

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!rows) {
    return <p className={styles.muted}>Loading users…</p>;
  }

  return (
    <>
      {actionError ? (
        <div className={styles.error} style={{ marginBottom: "0.75rem" }}>
          {actionError}
        </div>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Tier</th>
              <th className={styles.th}>Active</th>
              <th className={styles.th}>Period end</th>
              <th className={styles.th}>Discord ID</th>
              <th className={styles.th}>User ID</th>
              <th className={styles.th}>Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className={styles.td}>{u.email || "—"}</td>
                <td className={styles.td}>
                  <span
                    className={`${styles.pill} ${tierClass(u.subscriptionTier)}`}
                  >
                    {u.subscriptionTier}
                  </span>
                </td>
                <td className={styles.td}>
                  {u.subscriptionActive ? "Yes" : "No"}
                </td>
                <td className={styles.td}>{formatDate(u.periodEndMs)}</td>
                <td className={`${styles.td} ${styles.mono}`}>
                  {u.discordId ?? "—"}
                </td>
                <td className={`${styles.td} ${styles.mono}`}>{u.id}</td>
                <UserRowActions
                  user={u}
                  busy={busy}
                  setBusy={setBusy}
                  onUsersUpdated={(users) => {
                    setRows(users);
                    setActionError(null);
                  }}
                  onError={(msg) => setActionError(msg || null)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
