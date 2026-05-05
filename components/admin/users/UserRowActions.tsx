"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { adminDeleteJson, adminPostJson } from "@/lib/adminApi";
import { setStoredToken } from "@/lib/api";
import type { AdminUserRow, UsersListResponse } from "./adminUserTypes";
import styles from "./userRowActions.module.css";

type DialogState =
  | null
  | { kind: "plan"; tier: "pro" | "business" }
  | { kind: "extend" }
  | { kind: "password" }
  | { kind: "otp" };

function parseDaysInput(raw: string) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(3650, Math.floor(n));
}

function parseOtpHours(raw: string) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return 24;
  return Math.min(168, Math.floor(n));
}

function formatDateTime(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function tierPillClass(t: AdminUserRow["subscriptionTier"]) {
  if (t === "business") return styles.pillBus;
  if (t === "pro") return styles.pillPro;
  return styles.pillNone;
}

export function UserRowActions({
  user,
  onUsersUpdated,
  onError,
  busy,
  setBusy,
}: {
  user: AdminUserRow;
  onUsersUpdated: (users: AdminUserRow[]) => void;
  onError: (msg: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [daysInput, setDaysInput] = useState("30");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [otpPasswordInput, setOtpPasswordInput] = useState("");
  const [otpConfirmInput, setOtpConfirmInput] = useState("");
  const [otpHoursInput, setOtpHoursInput] = useState("24");

  useEffect(() => {
    if (!manageOpen && !dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialog?.kind === "password") {
        setPasswordInput("");
        setConfirmPasswordInput("");
      }
      if (dialog?.kind === "otp") {
        setOtpPasswordInput("");
        setOtpConfirmInput("");
        setOtpHoursInput("24");
      }
      if (dialog) setDialog(null);
      else if (manageOpen) setManageOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manageOpen, dialog]);

  const run = useCallback(
    async (fn: () => Promise<UsersListResponse>) => {
      setBusy(true);
      try {
        const data = await fn();
        onUsersUpdated(data.users);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [onError, onUsersUpdated, setBusy]
  );

  const base = `/api/admin/users/${encodeURIComponent(user.id)}`;

  const openCustomerDashboard = useCallback(async () => {
    if (
      !window.confirm(
        "Open the live customer dashboard as this user? You will leave the admin area; your admin token stays in this browser until it expires. The customer session lasts up to 8 hours. Continue?"
      )
    ) {
      return;
    }
    setSupportBusy(true);
    try {
      const data = await adminPostJson<{
        token: string;
        user: { id: string; email: string };
      }>(`${base}/support-session`, {});
      if (!data.token || !data.user) {
        throw new Error("Invalid response from server");
      }
      setStoredToken(data.token, { remember: false });
      window.location.assign("/dashboard");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Support login failed");
      setSupportBusy(false);
    }
  }, [base, onError]);

  const applyPlan = () => {
    if (!dialog || dialog.kind !== "plan") return;
    const days = parseDaysInput(daysInput);
    void run(() =>
      adminPostJson<UsersListResponse>(`${base}/plan`, {
        tier: dialog.tier,
        days,
      })
    );
    setDialog(null);
  };

  const applyExtend = () => {
    if (!dialog || dialog.kind !== "extend") return;
    const days = parseDaysInput(daysInput);
    void run(() =>
      adminPostJson<UsersListResponse>(`${base}/extend`, { days })
    );
    setDialog(null);
  };

  const applyPassword = () => {
    if (!dialog || dialog.kind !== "password") return;
    const p = passwordInput;
    if (p.length < 6) {
      onError("Password must be at least 6 characters");
      return;
    }
    if (p !== confirmPasswordInput) {
      onError("Passwords do not match");
      return;
    }
    void run(() =>
      adminPostJson<UsersListResponse>(`${base}/password`, { password: p })
    );
    setPasswordInput("");
    setConfirmPasswordInput("");
    setDialog(null);
  };

  const applyOtp = () => {
    if (!dialog || dialog.kind !== "otp") return;
    const p = otpPasswordInput;
    if (p.length < 6) {
      onError("One-time password must be at least 6 characters");
      return;
    }
    if (p !== otpConfirmInput) {
      onError("Passwords do not match");
      return;
    }
    const validHours = parseOtpHours(otpHoursInput);
    void run(() =>
      adminPostJson<UsersListResponse>(`${base}/one-time-password`, {
        password: p,
        validHours,
      })
    );
    setOtpPasswordInput("");
    setOtpConfirmInput("");
    setOtpHoursInput("24");
    setDialog(null);
  };

  const daysModal =
    dialog &&
    (dialog.kind === "plan" || dialog.kind === "extend") &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.overlayDays}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDialog(null);
            }}
          >
            <div
              className={styles.modal}
              role="dialog"
              aria-modal
              aria-labelledby="admin-days-title"
            >
              <h2 id="admin-days-title" className={styles.modalTitle}>
                {dialog.kind === "plan"
                  ? `Set ${dialog.tier === "business" ? "Business" : "Pro"} plan`
                  : "Extend subscription"}
              </h2>
              <label className={styles.modalLabel} htmlFor={`admin-days-${user.id}`}>
                Days (billing period length / extension)
              </label>
              <input
                id={`admin-days-${user.id}`}
                className={styles.modalInput}
                type="number"
                min={1}
                max={3650}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalBtn}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                  onClick={dialog.kind === "plan" ? applyPlan : applyExtend}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const passwordModal =
    dialog?.kind === "password" && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.overlayDays}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPasswordInput("");
                setConfirmPasswordInput("");
                setDialog(null);
              }
            }}
          >
            <div
              className={styles.modal}
              role="dialog"
              aria-modal
              aria-labelledby="admin-password-title"
            >
              <h2 id="admin-password-title" className={styles.modalTitle}>
                Set login password
              </h2>
              <p className={styles.modalHint}>
                Replaces their saved login password (works for email/password accounts
                too, e.g. forgotten password). Share securely; it is not shown again.
              </p>
              <label className={styles.modalLabel} htmlFor={`admin-pw-${user.id}`}>
                New password
              </label>
              <input
                id={`admin-pw-${user.id}`}
                className={styles.modalInput}
                type="password"
                autoComplete="new-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <label
                className={styles.modalLabel}
                htmlFor={`admin-pw2-${user.id}`}
              >
                Confirm password
              </label>
              <input
                id={`admin-pw2-${user.id}`}
                className={styles.modalInput}
                type="password"
                autoComplete="new-password"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalBtn}
                  onClick={() => {
                    setPasswordInput("");
                    setConfirmPasswordInput("");
                    setDialog(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                  onClick={applyPassword}
                >
                  Save password
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const otpModal =
    dialog?.kind === "otp" && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.overlayDays}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setOtpPasswordInput("");
                setOtpConfirmInput("");
                setOtpHoursInput("24");
                setDialog(null);
              }
            }}
          >
            <div
              className={styles.modal}
              role="dialog"
              aria-modal
              aria-labelledby="admin-otp-title"
            >
              <h2 id="admin-otp-title" className={styles.modalTitle}>
                One-time password
              </h2>
              <p className={styles.modalHint}>
                Extra login password only you assign: sign in with their email and this
                password. Their normal password is unchanged. After the next{" "}
                <strong>successful</strong> login using this password, it is removed
                automatically (one use). Expires after the hours below if unused.
              </p>
              <label className={styles.modalLabel} htmlFor={`admin-otp-h-${user.id}`}>
                Valid for (hours, max 168)
              </label>
              <input
                id={`admin-otp-h-${user.id}`}
                className={styles.modalInput}
                type="number"
                min={1}
                max={168}
                value={otpHoursInput}
                onChange={(e) => setOtpHoursInput(e.target.value)}
              />
              <label className={styles.modalLabel} htmlFor={`admin-otp-p-${user.id}`}>
                One-time password
              </label>
              <input
                id={`admin-otp-p-${user.id}`}
                className={styles.modalInput}
                type="password"
                autoComplete="new-password"
                value={otpPasswordInput}
                onChange={(e) => setOtpPasswordInput(e.target.value)}
              />
              <label
                className={styles.modalLabel}
                htmlFor={`admin-otp-p2-${user.id}`}
              >
                Confirm
              </label>
              <input
                id={`admin-otp-p2-${user.id}`}
                className={styles.modalInput}
                type="password"
                autoComplete="new-password"
                value={otpConfirmInput}
                onChange={(e) => setOtpConfirmInput(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalBtn}
                  onClick={() => {
                    setOtpPasswordInput("");
                    setOtpConfirmInput("");
                    setOtpHoursInput("24");
                    setDialog(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                  onClick={applyOtp}
                >
                  Save one-time password
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const managePanel =
    manageOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.overlay}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setManageOpen(false);
            }}
          >
            <div
              className={styles.managePanel}
              role="dialog"
              aria-modal
              aria-labelledby={`manage-title-${user.id}`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className={styles.manageHead}>
                <div className={styles.manageHeadText}>
                  <h2 id={`manage-title-${user.id}`} className={styles.manageTitle}>
                    {user.email || "User"}
                  </h2>
                  <p className={styles.manageMeta}>
                    Customer since{" "}
                    <strong>{formatDateTime(user.createdAt)}</strong>
                  </p>
                  <p className={styles.manageMetaMono} title={user.id}>
                    User ID · {user.id}
                  </p>
                  <p className={styles.manageMetaMono} title={user.discordId ?? ""}>
                    Discord · {user.discordId ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.manageClose}
                  aria-label="Close"
                  onClick={() => setManageOpen(false)}
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Bots</span>
                  <span className={styles.statValue}>{user.botCount ?? 0}</span>
                </div>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Ads today</span>
                  <span className={styles.statValue}>{user.adsPostedToday ?? 0}</span>
                </div>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Ads (7d)</span>
                  <span className={styles.statValue}>{user.adsPostedThisWeek ?? 0}</span>
                </div>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Ads (month)</span>
                  <span className={styles.statValue}>{user.adsPostedThisMonth ?? 0}</span>
                </div>
              </div>

              <div className={styles.subCard}>
                <div className={styles.subCardHeader}>
                  <span className={styles.subCardTitle}>Subscription</span>
                  <span
                    className={`${styles.pill} ${tierPillClass(user.subscriptionTier)}`}
                  >
                    {user.subscriptionTier}
                  </span>
                </div>
                <dl className={styles.subDl}>
                  <div className={styles.subDlRow}>
                    <dt>Active</dt>
                    <dd>{user.subscriptionActive ? "Yes" : "No"}</dd>
                  </div>
                  <div className={styles.subDlRow}>
                    <dt>Period ends</dt>
                    <dd>{formatDateTime(user.periodEndMs)}</dd>
                  </div>
                </dl>
              </div>

              <div className={styles.actionSections}>
                <div className={styles.actionBlock}>
                  <h3 className={styles.actionHeading}>Support</h3>
                  <p className={styles.actionHint}>
                    Opens the main app as this customer (same JWT shape as normal login).
                    Use for troubleshooting; session expires in about 8 hours. Sign out from
                    the profile menu when finished.
                  </p>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPro}`}
                      disabled={busy || supportBusy}
                      onClick={() => void openCustomerDashboard()}
                    >
                      {supportBusy ? "Opening…" : "Log in as customer"}
                    </button>
                  </div>
                </div>

                <div className={styles.actionBlock}>
                  <h3 className={styles.actionHeading}>Plan & billing</h3>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPro}`}
                      disabled={busy}
                      onClick={() => {
                        setDaysInput("30");
                        setDialog({ kind: "plan", tier: "pro" });
                      }}
                    >
                      Pro
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnBus}`}
                      disabled={busy}
                      onClick={() => {
                        setDaysInput("30");
                        setDialog({ kind: "plan", tier: "business" });
                      }}
                    >
                      Business
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        setDaysInput("30");
                        setDialog({ kind: "extend" });
                      }}
                    >
                      Extend
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Remove subscription record for this user? (Stripe id cleared.)"
                          )
                        )
                          return;
                        void run(() =>
                          adminDeleteJson<UsersListResponse>(`${base}/subscription`)
                        );
                      }}
                    >
                      Remove plan
                    </button>
                  </div>
                </div>

                <div className={styles.actionBlock}>
                  <h3 className={styles.actionHeading}>Posting</h3>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          adminPostJson<UsersListResponse>(`${base}/pause`, {})
                        )
                      }
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          adminPostJson<UsersListResponse>(`${base}/resume`, {})
                        )
                      }
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Stop posting: pause all channels and end burst campaign?"
                          )
                        )
                          return;
                        void run(() =>
                          adminPostJson<UsersListResponse>(`${base}/stop`, {})
                        );
                      }}
                    >
                      Stop
                    </button>
                  </div>
                </div>

                <div className={styles.actionBlock}>
                  <h3 className={styles.actionHeading}>Account</h3>
                  <p className={styles.actionHint}>
                    Passwords are hashed and cannot be displayed.{" "}
                    <strong>Set login password</strong> replaces their main password
                    (forgotten password, Discord-only, etc.).{" "}
                    <strong>One-time password</strong> adds a single-use extra login;
                    their normal password stays the same.
                  </p>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        setPasswordInput("");
                        setConfirmPasswordInput("");
                        setDialog({ kind: "password" });
                      }}
                    >
                      Set login password
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        setOtpPasswordInput("");
                        setOtpConfirmInput("");
                        setOtpHoursInput("24");
                        setDialog({ kind: "otp" });
                      }}
                    >
                      One-time password
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Remove any pending one-time password for this user?"
                          )
                        )
                          return;
                        void run(() =>
                          adminDeleteJson<UsersListResponse>(
                            `${base}/one-time-password`
                          )
                        );
                      }}
                    >
                      Revoke one-time password
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `PERMANENTLY delete user ${user.email || user.id} and all related bots, campaigns, and prefs?`
                          )
                        )
                          return;
                        void run(() => adminDeleteJson<UsersListResponse>(base));
                        setManageOpen(false);
                      }}
                    >
                      Delete user
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <td className={styles.actionsCell}>
      {daysModal}
      {passwordModal}
      {otpModal}
      {managePanel}
      <div className={styles.actionsCellInner}>
        <button
          type="button"
          className={styles.loginAsBtn}
          disabled={busy || supportBusy}
          title="Open customer dashboard (support)"
          onClick={() => void openCustomerDashboard()}
        >
          {supportBusy ? "…" : "Log in as"}
        </button>
        <button
          type="button"
          className={styles.manageBtn}
          disabled={busy}
          onClick={() => setManageOpen(true)}
        >
          Manage
        </button>
      </div>
    </td>
  );
}
