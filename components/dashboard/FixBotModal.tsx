"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import styles from "./add-bot-modal.module.css";

type FixBotModalProps = {
  open: boolean;
  onClose: () => void;
  botId: string;
  initialAccountEmail?: string | null;
  onFixed: () => void | Promise<void>;
};

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
  const [token, setToken] = useState("");
  const [working, setWorking] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    setEmail(initialAccountEmail?.trim() ?? "");
    setPassword("");
    setToken("");
    setWorking(false);
  }, [open, initialAccountEmail]);

  const handleSave = async () => {
    const t = token.trim();
    if (!t) return;
    setWorking(true);
    try {
      const body: Record<string, string> = { token: t };
      const e = email.trim();
      if (e) body.accountEmail = e;
      const p = password.trim();
      if (p) body.accountPassword = password;
      const res = await apiFetch(`/api/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update bot");
      await onFixed();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setWorking(false);
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
            <h2 className={styles.headTitle}>Fix bot</h2>
            <p className={styles.headSub}>
              Paste a fresh token from Discord. Email and password are optional;
              leave password blank to keep the one on file.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fix-bot-email">
              Email
            </label>
            <input
              id="fix-bot-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Discord account email (optional)"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fix-bot-pass">
              Password
            </label>
            <input
              id="fix-bot-pass"
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Only if you want to update stored password"
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fix-bot-token">
              Bot / user token
            </label>
            <input
              id="fix-bot-token"
              className={styles.input}
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste new token"
              autoComplete="off"
            />
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.finishBtn}
            onClick={() => void handleSave()}
            disabled={!token.trim() || working}
          >
            {working ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
