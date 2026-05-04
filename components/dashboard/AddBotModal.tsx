"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRight,
  X,
  ArrowLeft,
  CheckCircle2,
  Bot,
  Plus,
  Copy,
} from "lucide-react";
import { API_BASE, apiFetch } from "@/lib/api";
import styles from "./add-bot-modal.module.css";

/** User-supplied console snippet (verbatim). */
export const TOKEN_EXTRACT_SCRIPT = `(()=>{
  let t='';
  const o=open=XMLHttpRequest.prototype.open,
        s=XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open=function(m,u){this.u=u;return o.apply(this,arguments)};
  XMLHttpRequest.prototype.setRequestHeader=function(h,v){
    if(h.toLowerCase()==='authorization'&&this.u.includes('/v')){
      t=v;
      
      setTimeout(()=>navigator.clipboard.writeText(t),2000);
      
    }
    return s.apply(this,arguments);
  };
  const f=window.fetch;
  window.fetch=function(r,i){
    if(i?.headers){
      const v=i.headers.Authorization||i.headers.get?.('Authorization');
      if(v){
        t=v;
        
        setTimeout(()=>navigator.clipboard.writeText(t),2000);
        
      }
    }
    return f.apply(this,arguments);
  };
  fetch('https://discord.com/v9/users/@me',{credentials:'include'});
  
})();`;

type Flow =
  | "choose"
  | "existing"
  | "create-email"
  | "create-email-wait"
  | "create-phone"
  | "create-token";

const PASSWORD_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+";

function randomPassword(length = 18) {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join(
    ""
  );
}

function truncateMiddle(s: string, max = 52) {
  if (s.length <= max) return s;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatSmsWaitSeconds(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Cooldown before we encourage renting another number (overlapping ops confuse Discord). */
const SMS_RENT_COOLDOWN_SEC = 120;

function extractOtpFromSmsPreview(joined: string): string {
  const t = joined.replace(/\u00a0/g, " ").trim();
  if (!t) return "";
  const patterns = [
    /Discord\s+verification\s+code\s+is:?\s*(\d{4,8})\b/i,
    /Discord[^\n]{0,48}verification\s+code\s+is:?\s*(\d{4,8})\b/i,
    /verification\s+code\s+is:?\s*(\d{4,8})\b/i,
    /\bcode\s*:\s*(\d{4,8})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) return m[1];
  }
  const sixes = [...t.matchAll(/\b(\d{6})\b/g)];
  if (sixes.length) return sixes[sixes.length - 1][1];
  const eights = [...t.matchAll(/\b(\d{8})\b/g)];
  if (eights.length) return eights[eights.length - 1][1];
  return "";
}

/** API / legacy payloads may send smsText as an object; never show "[object Object]". */
function smsTextForPreview(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of ["smsText", "text", "msg", "message", "body", "content"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v.trim().length > 8) return v;
    }
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map((x) => (typeof x === "string" ? x : smsTextForPreview(x)))
      .filter(Boolean);
    return parts.join("\n");
  }
  return "";
}

const RE_CUSTOMER_TECH_JARGON =
  /onlinesim|mailinator|apikey|\.env|https?:\/\/|\.php\b|und_err|connect.?timeout|fetch failed|whatismyip|access from ip|api_access|wrong_key|no_key/i;

function scrubIfLeakedVendor(
  raw: string | undefined,
  fallback: string
): string {
  const m = String(raw ?? "").trim();
  if (!m) return fallback;
  if (RE_CUSTOMER_TECH_JARGON.test(m)) return fallback;
  return m.length > 160 ? `${m.slice(0, 157)}…` : m;
}

/** Customer-safe phone / SMS errors (no vendor or infra names). */
function friendlyPhoneError(raw: string | undefined): string {
  return scrubIfLeakedVendor(
    raw,
    "Phone verification hit a problem. Try again, switch network or VPN, or contact support."
  );
}

type InboxPreview = {
  messages: { id: string; subject: string; from: string; time: string }[];
  verificationLinks: string[];
};

type AddBotModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (result: { botId: string }) => void | Promise<void>;
};

export function AddBotModal({ open, onClose, onComplete }: AddBotModalProps) {
  const [mounted, setMounted] = useState(false);
  const [flow, setFlow] = useState<Flow>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [existingToken, setExistingToken] = useState("");
  const [existingEmail, setExistingEmail] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [pastedToken, setPastedToken] = useState("");
  const [working, setWorking] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [inboxPreview, setInboxPreview] = useState<InboxPreview | null>(null);
  const stickyVerifyLinksRef = useRef<string[]>([]);
  const simTzidRef = useRef<number | null>(null);
  const otpBannerRef = useRef<HTMLDivElement | null>(null);

  type SimCountry = { dialCode: number; name: string; key: string; priceUsd?: number };
  const [simCountries, setSimCountries] = useState<SimCountry[]>([]);
  const [simCountriesLoading, setSimCountriesLoading] = useState(false);
  const [simMetaErr, setSimMetaErr] = useState<string | null>(null);
  const [onlinesimConfigured, setOnlinesimConfigured] = useState(true);
  const [selectedDial, setSelectedDial] = useState<number | null>(null);
  const [simTzid, setSimTzid] = useState<number | null>(null);
  const [simPhoneDisplay, setSimPhoneDisplay] = useState("");
  const [simOrdering, setSimOrdering] = useState(false);
  const [simOrderErr, setSimOrderErr] = useState<string | null>(null);
  const [simOtp, setSimOtp] = useState("");
  const [simSmsPreview, setSimSmsPreview] = useState("");
  const [otpArrivedFlash, setOtpArrivedFlash] = useState(false);
  /** Seconds left to wait before we suggest renting again (null = no active wait). */
  const [simSmsWaitSec, setSimSmsWaitSec] = useState<number | null>(null);
  const [simSmsWaitTimedOut, setSimSmsWaitTimedOut] = useState(false);
  const [simSmsPollErr, setSimSmsPollErr] = useState<string | null>(null);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);

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
    setFlow("choose");
    setEmail("");
    setPassword("");
    setExistingToken("");
    setExistingEmail("");
    setExistingPassword("");
    setPastedToken("");
    setWorking(false);
    setGenError(null);
    setCredentialsLoading(false);
    setInboxPreview(null);
    stickyVerifyLinksRef.current = [];
    simTzidRef.current = null;
    setSimCountries([]);
    setSimCountriesLoading(false);
    setSimMetaErr(null);
    setOnlinesimConfigured(true);
    setSelectedDial(null);
    setSimTzid(null);
    setSimPhoneDisplay("");
    setSimOrdering(false);
    setSimOrderErr(null);
    setSimOtp("");
    setSimSmsPreview("");
    setOtpArrivedFlash(false);
    setSimSmsWaitSec(null);
    setSimSmsWaitTimedOut(false);
    setSimSmsPollErr(null);
    setCountryMenuOpen(false);
  }, [open]);

  useEffect(() => {
    if (flow !== "create-email-wait") {
      stickyVerifyLinksRef.current = [];
    }
  }, [flow]);

  useEffect(() => {
    if (flow !== "create-email-wait") return;
    const links = inboxPreview?.verificationLinks ?? [];
    if (links.length > 0) {
      stickyVerifyLinksRef.current = links;
    }
  }, [flow, inboxPreview?.verificationLinks]);

  useEffect(() => {
    if (!open || flow !== "create-email-wait" || !email.trim()) return;
    const poll = async () => {
      const res = await apiFetch(
        `/api/mailinator/inbox?email=${encodeURIComponent(email.trim())}`
      );
      if (res.ok) {
        const data = (await res.json()) as InboxPreview;
        setInboxPreview(data);
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [open, flow, email]);

  useEffect(() => {
    if (!open || flow !== "create-email") return;
    let cancelled = false;
    setGenError(null);
    setCredentialsLoading(true);
    setPassword(randomPassword(18));
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/generate-email`);
        const data = (await res.json()) as { email?: string; error?: string };
        if (!res.ok) {
          throw new Error(
            scrubIfLeakedVendor(
              data.error,
              "Could not create your signup email. Try again."
            )
          );
        }
        if (!cancelled && data.email) setEmail(data.email);
      } catch (e) {
        if (!cancelled) {
          setGenError(
            e instanceof Error ? e.message : "Could not reach the service. Try again."
          );
        }
      } finally {
        if (!cancelled) setCredentialsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, flow]);

  useEffect(() => {
    if (!open || flow !== "create-phone") return;
    let cancelled = false;
    setSimMetaErr(null);
    setSimCountriesLoading(true);
    (async () => {
      try {
        const res = await apiFetch("/api/onlinesim/countries");
        const data = (await res.json()) as {
          countries?: SimCountry[];
          configured?: boolean;
          error?: string;
          code?: string;
        };
        if (cancelled) return;
        setOnlinesimConfigured(data.configured !== false);
        if (!res.ok) {
          const parts = [data.error, data.code].filter(Boolean);
          const rawJoined = parts.join(" — ");
          setSimMetaErr(
            res.status === 503
              ? "Phone verification isn’t available on this site yet. Try again later or contact support."
              : res.status === 502
                ? "Could not reach phone verification. Try again or use another network."
                : parts.length > 0
                  ? scrubIfLeakedVendor(
                      rawJoined,
                      "Could not load phone options. Try again."
                    )
                  : "Could not load countries. Try again."
          );
          setSimCountries([]);
          return;
        }
        const list = Array.isArray(data.countries) ? data.countries : [];
        setSimCountries(list);
        const nlDial = 31;
        const nl = list.find((c) => c.dialCode === nlDial);
        setSelectedDial((prev) => prev ?? nl?.dialCode ?? list[0]?.dialCode ?? null);
      } catch {
        if (!cancelled) {
          setSimMetaErr("Could not connect. Check your connection and try again.");
          setSimCountries([]);
        }
      } finally {
        if (!cancelled) setSimCountriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, flow]);

  const pollSimSms = useCallback(async () => {
    if (simTzid == null) return;
    try {
      const res = await apiFetch(`/api/onlinesim/sms?tzid=${simTzid}`);
      let data: { code?: string | null; smsText?: string | null; error?: string };
      try {
        data = (await res.json()) as {
          code?: string | null;
          smsText?: string | null;
          error?: string;
        };
      } catch {
        setSimSmsPollErr("Could not read SMS response.");
        return;
      }
      if (!res.ok) {
        setSimSmsPollErr(friendlyPhoneError(data.error));
        return;
      }
      setSimSmsPollErr(null);
      const sms = smsTextForPreview(data.smsText);
      if (sms) setSimSmsPreview(sms);
      let code = "";
      if (typeof data.code === "string" || typeof data.code === "number") {
        const c = String(data.code).trim();
        if (/^\d{4,8}$/.test(c)) code = c;
      }
      if (!/^\d{4,8}$/.test(code) && sms) {
        const fb = extractOtpFromSmsPreview(sms);
        if (fb) code = fb;
      }
      if (/^\d{4,8}$/.test(code)) setSimOtp(code);
    } catch {
      setSimSmsPollErr("Could not refresh SMS status. Try Check now.");
    }
  }, [simTzid]);

  useEffect(() => {
    if (!open || flow !== "create-phone" || simTzid == null) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await pollSimSms();
    };
    void run();
    const iv = window.setInterval(() => {
      void run();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [open, flow, simTzid, pollSimSms]);

  /** After a number is rented: cooldown before we push “get new number” (avoids overlapping ops). */
  useEffect(() => {
    if (!open || flow !== "create-phone" || simTzid == null || simOtp) {
      setSimSmsWaitSec(null);
      setSimSmsWaitTimedOut(false);
      return;
    }
    setSimSmsWaitTimedOut(false);
    setSimSmsWaitSec(SMS_RENT_COOLDOWN_SEC);
    const started = Date.now();
    const iv = window.setInterval(() => {
      const left = Math.max(
        0,
        SMS_RENT_COOLDOWN_SEC -
          Math.floor((Date.now() - started) / 1000)
      );
      setSimSmsWaitSec(left);
      if (left <= 0) {
        window.clearInterval(iv);
        setSimSmsWaitTimedOut(true);
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [open, flow, simTzid, simOtp]);

  useEffect(() => {
    if (!countryMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = countryMenuRef.current;
      if (el && !el.contains(e.target as Node)) setCountryMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [countryMenuOpen]);

  /** List order comes from the API (Netherlands first, then A–Z). */
  const simCountriesDisplay = useMemo(() => [...simCountries], [simCountries]);

  const selectedCountryLabel = useMemo(() => {
    const c = simCountries.find((x) => x.dialCode === selectedDial);
    return c ? `${c.name} (+${c.dialCode})` : "—";
  }, [simCountries, selectedDial]);

  const lastOtpRef = useRef("");
  useEffect(() => {
    if (!simOtp) {
      lastOtpRef.current = "";
      return;
    }
    if (lastOtpRef.current === simOtp) return;
    lastOtpRef.current = simOtp;
    setOtpArrivedFlash(true);
    otpBannerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    const t = window.setTimeout(() => setOtpArrivedFlash(false), 4200);
    return () => window.clearTimeout(t);
  }, [simOtp]);

  const header = useMemo(() => {
    switch (flow) {
      case "choose":
        return {
          title: "Add bot",
          sub: "Link an existing application or walk through a new Discord account.",
        };
      case "existing":
        return {
          title: "Add existing bot",
          sub: "Discord email, password for your records, and token. We resolve the name from Discord when you save.",
        };
      case "create-email":
        return {
          title: "Create new bot · account",
          sub: "We create a throwaway email and password for you—use them on Discord’s signup page.",
        };
      case "create-email-wait":
        return {
          title: "Email verification",
          sub: "We watch for Discord’s message and show your verification links here.",
        };
      case "create-phone":
        return {
          title: "Phone verification",
          sub: "Choose a country, get an SMS number, enter it in Discord, then paste the code when it appears.",
        };
      case "create-token":
        return {
          title: "Token extraction",
          sub: "Run the snippet in your browser, then paste the captured value.",
        };
      default:
        return { title: "Add bot", sub: "" };
    }
  }, [flow]);

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN_EXTRACT_SCRIPT);
    } catch {
      /* ignore */
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    simTzidRef.current = simTzid;
  }, [simTzid]);

  const closeOnlineSimOp = useCallback(async () => {
    const id = simTzidRef.current;
    simTzidRef.current = null;
    setSimTzid(null);
    setSimPhoneDisplay("");
    setSimOtp("");
    setSimSmsPreview("");
    setOtpArrivedFlash(false);
    setSimSmsWaitSec(null);
    setSimSmsWaitTimedOut(false);
    if (!id) return;
    try {
      await apiFetch("/api/onlinesim/close", {
        method: "POST",
        body: JSON.stringify({ tzid: id }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) return;
    void (async () => {
      const id = simTzidRef.current;
      if (!id) return;
      simTzidRef.current = null;
      try {
        await apiFetch("/api/onlinesim/close", {
          method: "POST",
          body: JSON.stringify({ tzid: id }),
        });
      } catch {
        /* ignore */
      }
    })();
  }, [open]);

  const orderSimNumber = async () => {
    if (selectedDial == null) return;
    setSimOrderErr(null);
    setSimSmsPollErr(null);
    setSimOrdering(true);
    try {
      await closeOnlineSimOp();
      const res = await apiFetch("/api/onlinesim/number", {
        method: "POST",
        body: JSON.stringify({ country: selectedDial }),
      });
      const data = (await res.json()) as {
        tzid?: number;
        displayPhone?: string;
        phone?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        let msg: string;
        if (
          data.code === "API_ACCESS_IP" ||
          /api_access_ip/i.test(String(data.error ?? ""))
        ) {
          msg =
            "Your network couldn’t start phone verification. Try another Wi‑Fi, turn off VPN, or contact support.";
        } else {
          msg =
            friendlyPhoneError(data.error) ||
            "Could not get a number right now.";
        }
        throw new Error(msg);
      }
      const tz = Number(data.tzid);
      if (!Number.isFinite(tz) || tz < 1) {
        throw new Error(
          "We couldn’t assign a phone number. Try again or pick another country."
        );
      }
      simTzidRef.current = tz;
      setSimTzid(tz);
      setSimPhoneDisplay(
        (data.displayPhone && String(data.displayPhone)) ||
          (data.phone && String(data.phone)) ||
          ""
      );
      setSimOtp("");
      setSimSmsPreview("");
      lastOtpRef.current = "";
      setSimSmsWaitTimedOut(false);
    } catch (e) {
      setSimOrderErr(
        e instanceof Error ? friendlyPhoneError(e.message) : "Order failed"
      );
    } finally {
      setSimOrdering(false);
    }
  };

  const registerAndSync = async (
    token: string,
    account?: { email: string; password: string }
  ) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setWorking(true);
    try {
      const res = await apiFetch("/api/bots", {
        method: "POST",
        body: JSON.stringify({
          token: trimmed,
          ...(account
            ? {
                accountEmail: account.email.trim(),
                accountPassword: account.password,
              }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        bot?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not save bot");
      const botId = data.bot?.id;
      if (!botId) throw new Error("Invalid response");

      void Promise.resolve(onComplete({ botId })).catch((err) => {
        console.error(err);
        window.alert(
          err instanceof Error
            ? err.message
            : "Something went wrong after the bot was saved."
        );
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setWorking(false);
    }
  };

  const handleFinishExisting = async () => {
    const t = existingToken.trim();
    if (!t) return;
    await registerAndSync(t, {
      email: existingEmail,
      password: existingPassword,
    });
  };

  const handleFinishCreate = async () => {
    await registerAndSync(pastedToken, {
      email: email.trim(),
      password,
    });
  };

  const goToTokenStep = useCallback(async () => {
    await closeOnlineSimOp();
    setFlow("create-token");
  }, [closeOnlineSimOp]);

  if (!mounted || !open) return null;

  const modal = (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div
        className={`${styles.panel} ${styles.panelThemed}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={
            flow === "choose" ? `${styles.head} ${styles.headChoose}` : styles.head
          }
        >
          {flow === "choose" ? (
            <div className={styles.headChooseRow}>
              <span className={styles.headIconBadge} aria-hidden>
                <Bot size={20} strokeWidth={2.2} />
              </span>
              <div className={styles.headText}>
                <h2 className={styles.headTitle}>{header.title}</h2>
                <p className={styles.headSub}>{header.sub}</p>
              </div>
            </div>
          ) : (
            <div className={styles.headText}>
              <h2 className={styles.headTitle}>{header.title}</h2>
              <p className={styles.headSub}>{header.sub}</p>
            </div>
          )}
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
          {flow === "choose" ? (
            <div className={styles.chooseGrid}>
              <div className={styles.chooseCard}>
                <div className={styles.chooseCardArt}>
                  <Image
                    src="/add-bot/existing-bot.png"
                    alt=""
                    width={360}
                    height={360}
                    className={styles.chooseCardImg}
                    priority
                  />
                </div>
                <div className={styles.chooseCardBody}>
                  <h3 className={styles.chooseCardTitle}>Add existing bot</h3>
                  <p className={styles.chooseCardDesc}>
                    Discord login email &amp; password plus token; display name
                    comes from the account.
                  </p>
                </div>
                <div className={styles.chooseCardFooter}>
                  <button
                    type="button"
                    className={styles.chooseCardBtnGhost}
                    onClick={() => setFlow("existing")}
                  >
                    <span className={styles.chooseCardBtnIconGhost} aria-hidden>
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </span>
                    <span>Connect existing bot</span>
                  </button>
                </div>
              </div>
              <div
                className={`${styles.chooseCard} ${styles.chooseCardFeatured}`}
              >
                <div className={styles.chooseCardArt}>
                  <Image
                    src="/add-bot/new-bot.png"
                    alt=""
                    width={360}
                    height={360}
                    className={styles.chooseCardImg}
                    priority
                  />
                </div>
                <div className={styles.chooseCardBody}>
                  <h3 className={styles.chooseCardTitle}>Create new bot</h3>
                  <p className={styles.chooseCardDesc}>
                    Auto-generated test inbox and password, Discord signup, mail
                    verification, then token capture.
                  </p>
                </div>
                <div className={styles.chooseCardFooter}>
                  <button
                    type="button"
                    className={styles.chooseCardBtnPrimary}
                    onClick={() => setFlow("create-email")}
                  >
                    <span
                      className={styles.chooseCardBtnIconPrimary}
                      aria-hidden
                    >
                      <Plus size={16} strokeWidth={2.75} />
                    </span>
                    <span>Create new bot</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {flow === "existing" ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="existing-email">
                  Email
                </label>
                <input
                  id="existing-email"
                  className={styles.input}
                  type="email"
                  value={existingEmail}
                  onChange={(e) => setExistingEmail(e.target.value)}
                  placeholder="Discord account email"
                  autoComplete="off"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="existing-pass">
                  Password
                </label>
                <input
                  id="existing-pass"
                  className={styles.input}
                  type="password"
                  value={existingPassword}
                  onChange={(e) => setExistingPassword(e.target.value)}
                  placeholder="Discord account password"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="existing-token">
                  Bot / user token
                </label>
                <input
                  id="existing-token"
                  className={styles.input}
                  type="password"
                  value={existingToken}
                  onChange={(e) => setExistingToken(e.target.value)}
                  placeholder="Paste token"
                  autoComplete="off"
                />
                <div className={styles.scriptCopyRow}>
                  <button
                    type="button"
                    className={styles.scriptCopyBtn}
                    onClick={() => void copyScript()}
                  >
                    <Copy size={14} strokeWidth={2.25} aria-hidden />
                    Copy token extraction script
                  </button>
                  <p className={styles.scriptCopyHint}>
                    Open Discord in the browser, F12 → Console, paste the
                    script, press Enter, then use Discord so the token is
                    copied to your clipboard.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {flow === "create-email" ? (
            <>
              {credentialsLoading ? (
                <p className={styles.headSub} style={{ marginBottom: "0.75rem" }}>
                  Generating your signup email…
                </p>
              ) : null}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-email">
                  Email
                </label>
                <div className={styles.credentialRow}>
                  <input
                    id="reg-email"
                    className={`${styles.input} ${styles.credentialInput} ${styles.inputReadonly}`}
                    type="email"
                    value={email}
                    readOnly
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={`${styles.copyBtn} ${styles.copyBtnInline}`}
                    onClick={() => void copyText(email)}
                    disabled={!email.trim() || credentialsLoading}
                    aria-label="Copy email"
                  >
                    Copy
                  </button>
                </div>
                {genError ? (
                  <p className={styles.formError}>{genError}</p>
                ) : null}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-pass">
                  Password
                </label>
                <div className={styles.credentialRow}>
                  <input
                    id="reg-pass"
                    className={`${styles.input} ${styles.credentialInput} ${styles.inputReadonly}`}
                    type="text"
                    value={password}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className={`${styles.copyBtn} ${styles.copyBtnInline}`}
                    onClick={() => void copyText(password)}
                    disabled={!password.trim() || credentialsLoading}
                    aria-label="Copy password"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className={styles.headSub} style={{ marginBottom: "0.65rem" }}>
                Before continuing:
              </p>
              <ol className={styles.instructionList}>
                <li>Open a private / incognito browser window.</li>
                <li>
                  Go to{" "}
                  <a
                    href="https://discord.com/register"
                    target="_blank"
                    rel="noreferrer"
                  >
                    discord.com/register
                  </a>
                  .
                </li>
                <li>
                  Register using the generated email and password (use{" "}
                  <strong>Copy</strong> to paste into Discord).
                </li>
                <li>Complete Discord signup, then continue here.</li>
              </ol>
              <div className={styles.well}>
                The next step watches your inbox for Discord’s verification message
                and shows links here when they’re ready.
              </div>
            </>
          ) : null}

          {flow === "create-email-wait" ? (
            (() => {
              const latest = inboxPreview?.verificationLinks ?? [];
              const verifyLinks =
                stickyVerifyLinksRef.current.length > 0
                  ? stickyVerifyLinksRef.current
                  : latest;
              const hasVerifyLinks = verifyLinks.length > 0;
              const messages = inboxPreview?.messages ?? [];

              return (
                <div
                  className={`${styles.waitingBox} ${hasVerifyLinks ? styles.waitingBoxReady : ""}`}
                >
                  <div className={styles.verifyStatusBlock}>
                    {hasVerifyLinks ? (
                      <>
                        <CheckCircle2
                          className={styles.verifyCheckIcon}
                          size={36}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <h3 className={styles.waitingTitle}>
                          Verification link found
                        </h3>
                        <p className={styles.waitingHint}>
                          Open a link below, finish verification in Discord, then
                          tap <strong>Next step</strong>.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className={styles.spinner} aria-hidden />
                        <h3 className={styles.waitingTitle}>
                          Waiting for Discord’s email
                        </h3>
                        <p className={styles.waitingHint}>
                          We’ll show verification links here when they arrive.
                          After you verify in Discord, continue with{" "}
                          <strong>Next step</strong>.
                        </p>
                      </>
                    )}
                  </div>

                  {!hasVerifyLinks && messages.length > 0 ? (
                    <ul className={styles.verifyMessageList}>
                      {messages.slice(0, 8).map((m) => (
                        <li key={m.id}>{m.subject || m.id}</li>
                      ))}
                    </ul>
                  ) : null}

                  {hasVerifyLinks ? (
                    <ul className={styles.verifyLinkList}>
                      {verifyLinks.map((url, i) => (
                        <li key={`verify-${i}`} className={styles.verifyLinkCard}>
                          <div className={styles.verifyLinkCardTop}>
                            <span className={styles.verifyLinkBadge}>
                              {verifyLinks.length === 1
                                ? "Discord · verification"
                                : `Discord · link ${i + 1}`}
                            </span>
                            <div className={styles.verifyLinkActions}>
                              <a
                                href={url}
                                className={styles.verifyLinkOpen}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                className={styles.verifyLinkCopy}
                                onClick={() => void copyText(url)}
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <p className={styles.verifyLinkPreview} title={url}>
                            {truncateMiddle(url, 56)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })()
          ) : null}

          {flow === "create-phone" ? (
            <>
              {!onlinesimConfigured ? (
                <p className={styles.headSub} style={{ marginBottom: "0.75rem" }}>
                  Phone verification isn’t enabled for this site yet. Please try
                  again later or contact support.
                </p>
              ) : null}
              {simMetaErr ? (
                <p className={styles.formError}>{simMetaErr}</p>
              ) : null}

              <div className={styles.field}>
                <span className={styles.label} id="sim-country-label">
                  Country for SMS
                </span>
                <div
                  className={styles.countrySelectWrap}
                  ref={countryMenuRef}
                >
                  <button
                    type="button"
                    id="sim-country"
                    className={styles.countrySelectTrigger}
                    disabled={simCountriesLoading || simCountries.length === 0}
                    aria-expanded={countryMenuOpen}
                    aria-haspopup="listbox"
                    aria-labelledby="sim-country-label"
                    onClick={() => {
                      if (simCountriesLoading || simCountries.length === 0)
                        return;
                      setCountryMenuOpen((o) => !o);
                    }}
                  >
                    <span className={styles.countrySelectValue}>
                      {simCountriesLoading ? "Loading…" : selectedCountryLabel}
                    </span>
                    <span className={styles.countrySelectChevron} aria-hidden>
                      ▾
                    </span>
                  </button>
                  {countryMenuOpen && simCountriesDisplay.length > 0 ? (
                    <ul className={styles.countryMenu} role="listbox">
                      {simCountriesDisplay.map((c) => (
                        <li key={c.key} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedDial === c.dialCode}
                            className={
                              selectedDial === c.dialCode
                                ? `${styles.countryMenuItem} ${styles.countryMenuItemActive}`
                                : styles.countryMenuItem
                            }
                            onClick={() => {
                              setSelectedDial(c.dialCode);
                              setCountryMenuOpen(false);
                            }}
                          >
                            <span className={styles.countryMenuName}>
                              {c.name}
                            </span>
                            <span className={styles.countryDial}>
                              (+{c.dialCode})
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className={styles.nextBtn}
                style={{
                  marginBottom: "0.75rem",
                  width: "100%",
                  maxWidth: "20rem",
                }}
                title={
                  simTzid != null &&
                  !simOtp &&
                  !simSmsWaitTimedOut &&
                  (simSmsWaitSec ?? 0) > 0
                    ? "Wait for the 2-minute timer (or until the code arrives) before renting again."
                    : undefined
                }
                disabled={
                  simCountriesLoading ||
                  selectedDial == null ||
                  simOrdering ||
                  !onlinesimConfigured ||
                  (simTzid != null &&
                    !simOtp &&
                    !simSmsWaitTimedOut &&
                    (simSmsWaitSec ?? 0) > 0)
                }
                onClick={() => void orderSimNumber()}
              >
                {simOrdering ? "Getting number…" : "Get SMS number for Discord"}
              </button>

              {simOrderErr ? (
                <p className={styles.formError}>{simOrderErr}</p>
              ) : null}

              {simPhoneDisplay ? (
                <div className={styles.field}>
                  <span className={styles.label}>Phone number</span>
                  <div className={styles.credentialRow}>
                    <input
                      className={`${styles.input} ${styles.credentialInput} ${styles.inputReadonly}`}
                      readOnly
                      value={simPhoneDisplay}
                    />
                    <button
                      type="button"
                      className={`${styles.copyBtn} ${styles.copyBtnInline}`}
                      onClick={() => void copyText(simPhoneDisplay)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="discord-pass-phone">
                  Discord password (same as earlier step)
                </label>
                <div className={styles.credentialRow}>
                  <input
                    id="discord-pass-phone"
                    className={`${styles.input} ${styles.credentialInput} ${styles.inputReadonly}`}
                    type="text"
                    readOnly
                    value={password}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className={`${styles.copyBtn} ${styles.copyBtnInline}`}
                    onClick={() => void copyText(password)}
                    disabled={!password.trim()}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <p className={styles.headSub} style={{ marginBottom: "0.65rem" }}>
                Enter the phone number in Discord when asked. This page checks for
                your code every couple of seconds—it appears below as soon as it
                arrives. If you request a new number, the previous one is closed
                first so we always show the code for the number you’re using.
              </p>

              <div
                ref={otpBannerRef}
                className={`${styles.otpBox} ${simOtp ? styles.otpBoxActive : ""} ${otpArrivedFlash ? styles.otpBoxFlash : ""}`}
              >
                <div className={styles.otpLabel}>SMS verification code</div>
                <div
                  className={
                    simTzid != null && !simOtp
                      ? `${styles.otpRow} ${styles.otpRowStack}`
                      : styles.otpRow
                  }
                >
                  {simTzid == null ? (
                    <span className={styles.otpPlaceholder}>
                      Rent a number first, then request the SMS in Discord.
                    </span>
                  ) : !simOtp ? (
                    <>
                      <div className={styles.otpWaitRow}>
                        <div className={styles.otpSpinner} aria-hidden />
                        <div className={styles.otpWaitCol}>
                          <span className={styles.otpPlaceholder}>
                            Waiting for SMS…
                          </span>
                          {simSmsWaitSec != null && simSmsWaitSec > 0 ? (
                            <span className={styles.otpTimer}>
                              First wait {formatSmsWaitSeconds(simSmsWaitSec)} —
                              avoid a second rental until this ends (overlapping
                              numbers can confuse Discord).
                            </span>
                          ) : simSmsWaitSec === 0 || simSmsWaitTimedOut ? (
                            <span className={styles.otpTimer}>
                              The first wait ended — we still check automatically
                              every couple of seconds. Tap Check now if your
                              provider already shows the code.
                            </span>
                          ) : (
                            <span className={styles.otpTimer}>
                              Hang tight — starting the first wait timer…
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.otpCheckNowRow}>
                        <button
                          type="button"
                          className={styles.otpCheckNowBtn}
                          onClick={() => void pollSimSms()}
                        >
                          Check now
                        </button>
                      </div>
                      {simSmsPreview ? (
                        <p
                          className={styles.otpHintMuted}
                          title={simSmsPreview}
                        >
                          Last SMS from provider:{" "}
                          {truncateMiddle(
                            simSmsPreview.replace(/\s+/g, " ").trim(),
                            96
                          )}
                        </p>
                      ) : null}
                      {simSmsPollErr ? (
                        <p className={styles.formError}>{simSmsPollErr}</p>
                      ) : null}
                      {simSmsWaitTimedOut ? (
                        <div className={styles.otpStickyHint}>
                          <p className={styles.otpTimeoutMsg}>
                            Still no code? Rent a new number below.{" "}
                            <strong>Netherlands (+31)</strong> is the default
                            low-cost option for Discord — or pick another country
                            from the menu.
                          </p>
                          <div className={styles.countrySuggestRow}>
                            <button
                              type="button"
                              className={styles.countrySuggestChip}
                              disabled={
                                !simCountries.some((c) => c.dialCode === 31)
                              }
                              onClick={() => {
                                setSelectedDial(31);
                                setCountryMenuOpen(false);
                              }}
                            >
                              Use Netherlands +31
                            </button>
                          </div>
                          <button
                            type="button"
                            className={styles.otpRetryBtn}
                            disabled={
                              simOrdering ||
                              selectedDial == null ||
                              !onlinesimConfigured
                            }
                            onClick={() => void orderSimNumber()}
                          >
                            {simOrdering
                              ? "Getting number…"
                              : "Rent new SMS number"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className={styles.otpCode}>{simOtp}</span>
                  )}
                </div>
                {simSmsPreview && simOtp ? (
                  <p className={styles.smsPreview} title={simSmsPreview}>
                    {simSmsPreview.length > 160
                      ? `${simSmsPreview.slice(0, 160)}…`
                      : simSmsPreview}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {flow === "create-token" ? (
            <>
              <p className={styles.warn}>
                This targets your <strong>Discord user</strong> session token in the
                browser. Only use a private window you control.
              </p>
              <ol className={styles.instructionList}>
                <li>Open Discord in the browser for the user you registered.</li>
                <li>
                  F12 → Console, paste the script, press Enter, then interact with
                  Discord.
                </li>
              </ol>
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span>Browser console hook</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={copyScript}
                  >
                    Copy
                  </button>
                </div>
                <pre className={styles.pre}>{TOKEN_EXTRACT_SCRIPT}</pre>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="paste-token">
                  Paste token here
                </label>
                <textarea
                  id="paste-token"
                  className={styles.input}
                  style={{ minHeight: 88, resize: "vertical" }}
                  value={pastedToken}
                  onChange={(e) => setPastedToken(e.target.value)}
                  placeholder="Paste value from clipboard or console"
                  spellCheck={false}
                />
              </div>
            </>
          ) : null}
        </div>

        {flow !== "choose" ? (
          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                void (async () => {
                  if (flow === "create-phone") await closeOnlineSimOp();
                  if (flow === "existing") setFlow("choose");
                  else if (flow === "create-email") setFlow("choose");
                  else if (flow === "create-email-wait")
                    setFlow("create-email");
                  else if (flow === "create-phone")
                    setFlow("create-email-wait");
                  else if (flow === "create-token") setFlow("create-phone");
                })();
              }}
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Back
            </button>

            {flow === "existing" ? (
              <button
                type="button"
                className={styles.finishBtn}
                onClick={() => void handleFinishExisting()}
                disabled={
                  !existingEmail.trim() ||
                  !existingPassword.trim() ||
                  !existingToken.trim() ||
                  working
                }
              >
                {working ? "Saving…" : "Finish"}
              </button>
            ) : null}

            {flow === "create-email" ? (
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => setFlow("create-email-wait")}
                disabled={
                  !email.trim() ||
                  !password.trim() ||
                  credentialsLoading
                }
              >
                Next step
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            ) : null}

            {flow === "create-email-wait" ? (
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => setFlow("create-phone")}
              >
                Next step
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            ) : null}

            {flow === "create-phone" ? (
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => void goToTokenStep()}
              >
                Next: token step
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            ) : null}

            {flow === "create-token" ? (
              <button
                type="button"
                className={styles.finishBtn}
                onClick={() => void handleFinishCreate()}
                disabled={!pastedToken.trim() || working}
              >
                {working ? "Saving…" : "Finish"}
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
