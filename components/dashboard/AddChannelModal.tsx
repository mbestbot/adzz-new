"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./add-bot-modal.module.css";
import s from "./servers.module.css";

type ApiChannel = { id: string; name: string; type: number };

const NAME_KEYWORDS = [
  "advertisement",
  "ads",
  "discord",
  "selling",
  "seller",
] as const;

/** Ad-style channels: advertisement, ads, or the word “ad”. */
export function channelNameMatchesAdvertisingFocus(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("advertisement")) return true;
  if (n.includes("ads")) return true;
  return /\bad\b/i.test(name);
}

/** Trade / seller channels. */
export function channelNameMatchesSellingFocus(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("selling") || n.includes("seller");
}

/** Same filter as “Add channel” without “Show all” (suggested picks). */
export function channelNameMatchesAdKeywords(name: string): boolean {
  const n = name.toLowerCase();
  for (const k of NAME_KEYWORDS) {
    if (n.includes(k)) return true;
  }
  return /\bad\b/i.test(name);
}

type AddChannelModalProps = {
  open: boolean;
  onClose: () => void;
  guildName: string;
  channels: ApiChannel[];
  alreadyAddedIds: ReadonlySet<string>;
  onPick: (channel: ApiChannel) => void;
};

export function AddChannelModal({
  open,
  onClose,
  guildName,
  channels,
  alreadyAddedIds,
  onPick,
}: AddChannelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
    if (open) setShowAll(false);
  }, [open, guildName]);

  const textChannels = useMemo(
    () =>
      [...channels].filter((c) => c.type === 0).sort((a, b) => a.name.localeCompare(b.name)),
    [channels]
  );

  const visibleChannels = useMemo(() => {
    if (showAll) return textChannels;
    return textChannels.filter((c) => channelNameMatchesAdKeywords(c.name));
  }, [showAll, textChannels]);

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
            <h2 className={styles.headTitle}>Add channel · {guildName}</h2>
            <p className={styles.headSub}>
              Suggested names match: Ad, advertisement, ads, discord, selling,
              seller. Turn on <strong>Show all</strong> to pick any text channel.
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
          <label className={s.addChannelToggleRow}>
            <input
              type="checkbox"
              className={s.addChannelToggleInput}
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            <span>Show all channels</span>
          </label>

          {visibleChannels.length === 0 ? (
            <p className={styles.headSub} style={{ marginTop: "0.5rem" }}>
              {showAll
                ? "No text channels in cache for this server."
                : "No channels match the keyword filter. Enable “Show all channels” or refresh from Discord."}
            </p>
          ) : (
            <ul className={s.addChannelPickList} role="listbox" aria-label="Channels">
              {visibleChannels.map((c) => {
                const taken = alreadyAddedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      className={`${s.addChannelPickItem} ${taken ? s.addChannelPickItemDisabled : ""}`}
                      disabled={taken}
                      onClick={() => {
                        if (taken) return;
                        onPick(c);
                        onClose();
                      }}
                    >
                      <span className={s.addChannelPickName}>#{c.name}</span>
                      {taken ? (
                        <span className={s.addChannelPickHint}>Added</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.backBtn} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
