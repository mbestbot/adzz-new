"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  adminGetJson,
  adminPatchJson,
} from "@/lib/adminApi";
import type {
  AdminBotDetail,
  AdminBotDetailResponse,
  AdminBotPatchResponse,
} from "./adminBotTypes";
import { DISCORD_USER_TOKEN_EXTRACTION_SCRIPT } from "./discordTokenExtractionScript";
import styles from "./bots.module.css";

function copyFeedback(setMsg: (s: string | null) => void, ok: string) {
  setMsg(ok);
  setTimeout(() => setMsg(null), 2000);
}

export function BotInfoModal({
  botId,
  open,
  onClose,
  onSaved,
}: {
  botId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<AdminBotDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !botId) {
      setDetail(null);
      setLoadErr(null);
      return;
    }
    let cancelled = false;
    setLoadErr(null);
    adminGetJson<AdminBotDetailResponse>(`/api/admin/bots/${encodeURIComponent(botId)}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d.bot);
        setTokenInput(d.bot.token ?? "");
        setEmailInput(d.bot.accountEmail ?? "");
        setPassInput(d.bot.accountPassword ?? "");
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, botId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copyText = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback(setCopyMsg, `Copied ${label}`);
    } catch {
      setCopyMsg("Copy failed — select text manually");
    }
  }, []);

  const save = useCallback(async () => {
    if (!botId) return;
    setSaveErr(null);
    setBusy(true);
    try {
      const body: {
        token?: string;
        accountEmail?: string;
        accountPassword?: string;
      } = {};
      if (detail && tokenInput.trim() !== (detail.token ?? "").trim()) {
        if (!tokenInput.trim()) {
          setSaveErr("Token cannot be empty — leave unchanged or paste a new token");
          setBusy(false);
          return;
        }
        body.token = tokenInput.trim();
      }
      if (emailInput.trim() !== (detail?.accountEmail ?? "").trim()) {
        body.accountEmail = emailInput.trim();
      }
      if (passInput !== (detail?.accountPassword ?? "")) {
        body.accountPassword = passInput;
      }
      if (
        body.token === undefined &&
        body.accountEmail === undefined &&
        body.accountPassword === undefined
      ) {
        setSaveErr("No changes to save");
        setBusy(false);
        return;
      }
      const res = await adminPatchJson<AdminBotPatchResponse>(
        `/api/admin/bots/${encodeURIComponent(botId)}`,
        body
      );
      if (res.bot) {
        setDetail(res.bot);
        setTokenInput(res.bot.token ?? "");
        setEmailInput(res.bot.accountEmail ?? "");
        setPassInput(res.bot.accountPassword ?? "");
      }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [botId, detail, emailInput, passInput, tokenInput, onSaved]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-info-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 id="bot-info-title" className={styles.modalTitle}>
            Bot credentials
          </h2>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {copyMsg ? <p className={styles.copyToast}>{copyMsg}</p> : null}
          {loadErr ? (
            <p className={styles.errorInline}>{loadErr}</p>
          ) : !detail ? (
            <p className={styles.muted}>Loading…</p>
          ) : (
            <>
              <p className={styles.metaLine}>
                <span className={styles.metaLabel}>Owner</span>{" "}
                {detail.ownerEmail || "—"}{" "}
                <span className={styles.metaMuted}>({detail.userId})</span>
              </p>
              <p className={styles.metaLine}>
                <span className={styles.metaLabel}>Discord</span>{" "}
                {detail.displayName} <span className={styles.metaMuted}>@{detail.username}</span>
              </p>

              <label className={styles.fieldLabel}>Account email (Add bot)</label>
              <div className={styles.fieldRow}>
                <input
                  className={styles.input}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => void copyText("email", emailInput)}
                >
                  Copy
                </button>
              </div>

              <label className={styles.fieldLabel}>Account password</label>
              <div className={styles.fieldRow}>
                <input
                  className={styles.input}
                  type="password"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => void copyText("password", passInput)}
                >
                  Copy
                </button>
              </div>

              <label className={styles.fieldLabel}>
                Token ({detail.tokenType}) — edit to rotate
              </label>
              <textarea
                className={styles.textarea}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                spellCheck={false}
                rows={4}
              />
              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => void copyText("token", tokenInput)}
                >
                  Copy token
                </button>
              </div>

              <div className={styles.scriptBlock}>
                <div className={styles.scriptHead}>
                  <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>
                    User-token extraction script (browser console)
                  </span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() =>
                      void copyText("script", DISCORD_USER_TOKEN_EXTRACTION_SCRIPT)
                    }
                  >
                    Copy script
                  </button>
                </div>
                <pre className={styles.scriptPre}>
                  {DISCORD_USER_TOKEN_EXTRACTION_SCRIPT}
                </pre>
              </div>

              {saveErr ? <p className={styles.errorInline}>{saveErr}</p> : null}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className={styles.cancelBtn} onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
