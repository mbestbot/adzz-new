"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Image, Plus, Trash2 } from "lucide-react";
import { discordAvatarUrl } from "@/lib/discordAvatar";
import { AddBotModal } from "./AddBotModal";
import { useBots } from "./BotContext";
import pack from "./icon-pack.module.css";
import styles from "./user-profile.module.css";

export function UserProfileChip() {
  const menuId = useId();
  const {
    bots,
    activeBotId,
    setActiveBotId,
    refreshBots,
    deleteBot,
    refreshBotProfile,
  } = useBots();
  const [open, setOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshingPfp, setRefreshingPfp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const hasBots = bots.length > 0;
  const activeBot = bots.find((b) => b.id === activeBotId);
  const chipAvatarBot = hasBots ? (activeBot ?? bots[0]) : null;

  const primaryLabel = hasBots
    ? activeBot?.displayName ?? "Select a bot"
    : "Add your first bot";
  const secondaryLabel = hasBots
    ? activeBot
      ? `@${activeBot.username}`
      : null
    : "No bots linked yet";

  return (
    <>
      <div className={styles.botMenuWrap} ref={wrapRef}>
        <button
          type="button"
          className={styles.botMenuTrigger}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          aria-label={
            hasBots
              ? `Bots: ${activeBot?.displayName ?? "choose a bot"}`
              : "Add your first bot"
          }
          onClick={() => setOpen((o) => !o)}
        >
          <div
            className={pack.avatarRing}
            aria-hidden
          >
            {chipAvatarBot ? (
              <div
                className={`${styles.chipAvatar} ${styles.chipAvatarWithPhoto}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={discordAvatarUrl(chipAvatarBot, 80)}
                  alt=""
                  width={40}
                  height={40}
                  className={styles.chipAvatarPhoto}
                />
              </div>
            ) : (
              <div className={pack.avatarRingInner}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand-mark.png"
                  alt=""
                  width={40}
                  height={40}
                  className={styles.brandMarkFill}
                />
              </div>
            )}
          </div>
          <span className={styles.botMenuTriggerText}>
            <span className={styles.chipName}>{primaryLabel}</span>
            {secondaryLabel ? (
              <span className={styles.botMenuActiveBot} title={secondaryLabel}>
                {secondaryLabel}
              </span>
            ) : null}
          </span>
          <ChevronDown
            size={18}
            className={`${styles.botMenuChevron} ${open ? styles.botMenuChevronOpen : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <div
            id={menuId}
            className={styles.botMenuPanel}
            role="listbox"
            aria-label="Bots"
          >
            <button
              type="button"
              className={styles.botMenuAdd}
              role="option"
              onClick={() => {
                setAddModalOpen(true);
                close();
              }}
            >
              <Plus size={17} strokeWidth={2.5} />
              Add new bot
            </button>
            {hasBots && activeBotId ? (
              <button
                type="button"
                className={styles.botMenuRefreshPfp}
                role="option"
                disabled={refreshingPfp}
                onClick={() => {
                  void (async () => {
                    setRefreshingPfp(true);
                    try {
                      const r = await refreshBotProfile(activeBotId);
                      if (!r.ok) {
                        window.alert(
                          r.error ?? "Could not refresh photo from Discord."
                        );
                      }
                    } finally {
                      setRefreshingPfp(false);
                    }
                    close();
                  })();
                }}
              >
                <Image size={17} strokeWidth={2} aria-hidden />
                {refreshingPfp ? "Updating photo…" : "Refresh photo from Discord"}
              </button>
            ) : null}
            <div className={styles.botMenuDivider} />
            <div className={styles.botMenuListLabel}>Your bots</div>
            <ul className={styles.botMenuList}>
              {bots.length === 0 ? (
                <li className={styles.botMenuListLabel}>No bots yet</li>
              ) : null}
              {bots.map((bot) => {
                const selected = bot.id === activeBotId;
                const label = bot.displayName || bot.username || "this bot";
                return (
                  <li key={bot.id} className={styles.botMenuItemRow}>
                    <button
                      type="button"
                      className={`${styles.botMenuItem} ${styles.botMenuItemSelect} ${selected ? styles.botMenuItemSelected : ""}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setActiveBotId(bot.id);
                        close();
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={discordAvatarUrl(bot, 64)}
                        alt=""
                        width={28}
                        height={28}
                        className={styles.botMenuItemAvatar}
                      />
                      <span className={styles.botMenuItemName}>
                        {bot.displayName}
                      </span>
                      {selected ? (
                        <Check
                          size={16}
                          className={styles.botMenuCheck}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className={styles.botMenuCheckSpacer}
                          aria-hidden
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.botMenuDelete}
                      aria-label={`Delete ${label}`}
                      title="Delete bot"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (
                          !window.confirm(
                            `Delete bot "${label}"? This cannot be undone.`
                          )
                        ) {
                          return;
                        }
                        void (async () => {
                          const r = await deleteBot(bot.id);
                          if (!r.ok) {
                            window.alert(r.error ?? "Could not delete bot.");
                            return;
                          }
                          close();
                        })();
                      }}
                    >
                      <Trash2 size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <AddBotModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onComplete={({ botId }) => {
          setActiveBotId(botId);
          setAddModalOpen(false);
          void refreshBots();
        }}
      />
    </>
  );
}
