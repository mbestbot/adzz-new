"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./add-bot-modal.module.css";
import s from "./servers.module.css";

export type AutoConfigureMode = "advertising" | "selling" | "keywords";

type AutoConfigureChannelsModalProps = {
  open: boolean;
  onClose: () => void;
  applying: boolean;
  onApply: (mode: AutoConfigureMode) => void | Promise<void>;
};

export function AutoConfigureChannelsModal({
  open,
  onClose,
  applying,
  onApply,
}: AutoConfigureChannelsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AutoConfigureMode>("keywords");

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
    if (open) setMode("keywords");
  }, [open]);

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
            <h2 className={styles.headTitle}>Auto configure channels</h2>
            <p className={styles.headSub}>
              Pick how to match channel names. We add matching text channels on
              every server you have in cache (same as linked channels you choose
              manually). Existing links are kept; only new matches are added.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
            disabled={applying}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <div role="radiogroup" aria-label="Match mode" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label
              className={s.addChannelToggleRow}
              style={{ alignItems: "flex-start", marginBottom: 0 }}
            >
              <input
                type="radio"
                name="autoConfigureMode"
                className={s.addChannelToggleInput}
                checked={mode === "advertising"}
                onChange={() => setMode("advertising")}
                disabled={applying}
                style={{ marginTop: "0.15rem" }}
              />
              <span>
                <strong>Advertising</strong>
                <p className={styles.headSub} style={{ margin: "0.35rem 0 0", fontWeight: 500 }}>
                  advertisement, ads, or the word ad
                </p>
              </span>
            </label>
            <label
              className={s.addChannelToggleRow}
              style={{ alignItems: "flex-start", marginBottom: 0 }}
            >
              <input
                type="radio"
                name="autoConfigureMode"
                className={s.addChannelToggleInput}
                checked={mode === "selling"}
                onChange={() => setMode("selling")}
                disabled={applying}
                style={{ marginTop: "0.15rem" }}
              />
              <span>
                <strong>Selling</strong>
                <p className={styles.headSub} style={{ margin: "0.35rem 0 0", fontWeight: 500 }}>
                  channel names containing selling or seller
                </p>
              </span>
            </label>
            <label
              className={s.addChannelToggleRow}
              style={{ alignItems: "flex-start", marginBottom: 0 }}
            >
              <input
                type="radio"
                name="autoConfigureMode"
                className={s.addChannelToggleInput}
                checked={mode === "keywords"}
                onChange={() => setMode("keywords")}
                disabled={applying}
                style={{ marginTop: "0.15rem" }}
              />
              <span>
                <strong>Keywords (suggested)</strong>
                <p className={styles.headSub} style={{ margin: "0.35rem 0 0", fontWeight: 500 }}>
                  same as Add channel without “Show all”: ad, advertisement, ads,
                  discord, selling, seller
                </p>
              </span>
            </label>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
            disabled={applying}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.nextBtn}
            onClick={() => void onApply(mode)}
            disabled={applying}
          >
            {applying ? "Applying…" : "Apply to all servers"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
