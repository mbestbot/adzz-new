"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Copy, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import styles from "./add-bot-modal.module.css";
import r from "./fix-bot-recovery.module.css";

type FixBotModalProps = {
  open: boolean;
  onClose: () => void;
  botId: string;
  initialAccountEmail?: string | null;
  onFixed: () => void | Promise<void>;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function FixBotModal({
  open,
  onClose,
  botId,
  initialAccountEmail,
  onFixed,
}: FixBotModalProps) {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newToken, setNewToken] = useState("");
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [working, setWorking] = useState<null | "email" | "password" | "token">(
    null
  );
  const [flash, setFlash] = useState<string | null>(null);
  const [scriptBusy, setScriptBusy] = useState<null | "extract" | "login">(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const loadRecovery = useCallback(async () => {
    setLoadingRecovery(true);
    try {
      const res = await apiFetch(`/api/bots/${encodeURIComponent(botId)}/recovery`);
      const data = (await res.json().catch(() => ({}))) as {
        accountEmail?: string | null;
        accountPassword?: string | null;
        error?: string;
      };
      if (!res.ok) {
        window.alert(data.error ?? "Could not load recovery data.");
        setEmail(initialAccountEmail?.trim() ?? "");
        setPassword("");
        return;
      }
      setEmail(
        (data.accountEmail ?? initialAccountEmail ?? "").trim() || ""
      );
      setPassword(data.accountPassword ?? "");
    } finally {
      setLoadingRecovery(false);
    }
  }, [botId, initialAccountEmail]);

  useEffect(() => {
    if (!open) return;
    setNewToken("");
    setFlash(null);
    void loadRecovery();
  }, [open, loadRecovery]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  };

  const patchCredentials = async (
    patch: Record<string, string>,
    mode: "email" | "password"
  ) => {
    setWorking(mode);
    try {
      const res = await apiFetch(`/api/bots/${encodeURIComponent(botId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Update failed");
        return;
      }
      showFlash("Saved");
      await onFixed();
    } finally {
      setWorking(null);
    }
  };

  const onCopyEmail = () => {
    void copyToClipboard(email).then((ok) =>
      showFlash(ok ? "Email copied" : "Copy failed")
    );
  };

  const onCopyPassword = () => {
    void copyToClipboard(password).then((ok) =>
      showFlash(ok ? "Password copied" : "Copy failed")
    );
  };

  const onUpdateEmail = () => {
    void patchCredentials({ accountEmail: email.trim() }, "email");
  };

  const onUpdatePassword = () => {
    void patchCredentials({ accountPassword: password }, "password");
  };

  const fetchScript = async (path: "token-extraction-script" | "login-script") => {
    const res = await apiFetch(
      `/api/bots/${encodeURIComponent(botId)}/recovery/${path}`
    );
    const data = (await res.json().catch(() => ({}))) as {
      script?: string;
      error?: string;
    };
    if (!res.ok) {
      window.alert(data.error ?? `Could not load script (${res.status})`);
      return null;
    }
    return data.script ?? null;
  };

  const onCopyTokenExtractionScript = async () => {
    setScriptBusy("extract");
    try {
      const script = await fetchScript("token-extraction-script");
      if (!script) return;
      const ok = await copyToClipboard(script);
      showFlash(ok ? "Token extraction script copied" : "Copy failed");
    } finally {
      setScriptBusy(null);
    }
  };

  const onCopyLoginScript = async () => {
    setScriptBusy("login");
    try {
      const script = await fetchScript("login-script");
      if (!script) return;
      const ok = await copyToClipboard(script);
      showFlash(
        ok
          ? "Login script copied (includes this bot’s token from the server)"
          : "Copy failed"
      );
    } finally {
      setScriptBusy(null);
    }
  };

  const onSaveNewToken = async () => {
    const t = newToken.trim();
    if (!t) return;
    setWorking("token");
    try {
      const body: Record<string, string> = { token: t };
      const e = email.trim();
      body.accountEmail = e;
      body.accountPassword = password;
      const res = await apiFetch(`/api/bots/${encodeURIComponent(botId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update bot");
      setNewToken("");
      await onFixed();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setWorking(null);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div
        className={styles.panel}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.headTitle}>Bot recovery</h2>
            <p className={styles.headSub}>
              Email and password are shown from your saved bot record. The
              Discord token is never shown here; use the scripts below or paste
              a new token in the optional section.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
            disabled={Boolean(working)}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={`${styles.body} ${r.recoveryScrollBody}`}>
          {flash ? (
            <p className={r.muted} role="status" style={{ marginBottom: "0.65rem" }}>
              {flash}
            </p>
          ) : null}

          {loadingRecovery ? (
            <p className={r.muted}>
              <Loader2 size={16} className={r.iconSpin} aria-hidden />
              Loading saved credentials…
            </p>
          ) : null}

          <div className={r.section}>
            <h3 className={r.sectionTitle}>Account email</h3>
            <div className={r.recoveryRow}>
              <input
                className={`${styles.input} ${r.recoveryInput}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Discord account email"
                autoComplete="off"
                disabled={loadingRecovery}
              />
              <div className={r.recoveryActions}>
                <button
                  type="button"
                  className={r.btnMini}
                  onClick={onCopyEmail}
                  disabled={!email.trim()}
                >
                  <Copy size={14} strokeWidth={2} aria-hidden />
                  Copy
                </button>
                <button
                  type="button"
                  className={r.btnMini}
                  onClick={onUpdateEmail}
                  disabled={working !== null || loadingRecovery}
                >
                  {working === "email" ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </div>

          <div className={r.section}>
            <h3 className={r.sectionTitle}>Account password</h3>
            <div className={r.recoveryRow}>
              <input
                className={`${styles.input} ${r.recoveryInput}`}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Saved password (if any)"
                autoComplete="off"
                disabled={loadingRecovery}
              />
              <div className={r.recoveryActions}>
                <button
                  type="button"
                  className={r.btnMini}
                  onClick={onCopyPassword}
                  disabled={password.length === 0}
                >
                  <Copy size={14} strokeWidth={2} aria-hidden />
                  Copy
                </button>
                <button
                  type="button"
                  className={r.btnMini}
                  onClick={onUpdatePassword}
                  disabled={working !== null || loadingRecovery}
                >
                  {working === "password" ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </div>

          <div className={r.section}>
            <h3 className={r.sectionTitle}>Discord scripts</h3>
            <p className={r.muted} style={{ marginBottom: "0.5rem" }}>
              The stored token is inserted on the server when you copy the login
              script. It is not shown in this panel.
            </p>
            <div className={`${r.scriptRow} ${r.scriptRowFirst}`}>
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => void onCopyTokenExtractionScript()}
                disabled={scriptBusy !== null || loadingRecovery}
              >
                {scriptBusy === "extract" ? "Preparing…" : "Token extraction script"}
              </button>
            </div>
            <div className={r.scriptRow}>
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => void onCopyLoginScript()}
                disabled={scriptBusy !== null || loadingRecovery}
              >
                {scriptBusy === "login" ? "Preparing…" : "Login script"}
              </button>
              <div className={r.hintWrap}>
                <button
                  type="button"
                  className={r.hintBtn}
                  aria-label="Where to run the login script"
                  title="On discord.com/login: F12 → Console → paste the login script and press Enter. The script includes this bot’s token from Adzz."
                >
                  <CircleHelp size={15} strokeWidth={2} aria-hidden />
                </button>
                <div className={r.hintPopover} role="tooltip">
                  Open{" "}
                  <strong>https://discord.com/login</strong>, then press F12 →
                  <strong> Console</strong>, paste the copied login script, and press
                  Enter. The script already includes this bot’s token from Adzz—do
                  not share it or run it on untrusted sites.
                </div>
              </div>
            </div>
          </div>

          <details className={r.tokenPanel}>
            <summary>Optional: paste a new Discord token</summary>
            <p className={r.muted}>
              After you extract a token elsewhere, paste it here to replace the
              one we have on file. Your email and password fields above are sent
              with the save so they stay in sync.
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fix-bot-new-token">
                New token
              </label>
              <input
                id="fix-bot-new-token"
                className={styles.input}
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="Paste token (hidden while typing)"
                autoComplete="off"
              />
            </div>
          </details>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
            disabled={Boolean(working)}
          >
            Close
          </button>
          <button
            type="button"
            className={styles.finishBtn}
            onClick={() => void onSaveNewToken()}
            disabled={!newToken.trim() || working !== null}
          >
            {working === "token" ? "Saving…" : "Save new token"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
