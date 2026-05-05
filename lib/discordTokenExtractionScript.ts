/**
 * Discord web client user-token extraction snippet (DevTools console on discord.com/app).
 * Used by dashboard (Add bot, Fix bot) and admin bot credentials UI.
 */
export const DISCORD_USER_TOKEN_EXTRACTION_SCRIPT = `// Paste in DevTools → Console on https://discord.com/app while logged in.
// WARNING: A user token is like a password. Never paste it on untrusted sites.
// For BOT tokens, use https://discord.com/developers/applications → Bot → Reset Token.
//
// This script tries localStorage/sessionStorage first, then Discord's webpack modules,
// then copies to your clipboard and shows an alert.
// If you see "localStorage is not defined", set the console context dropdown to the top frame (discord.com).

(async function discordCopyToken() {
  if (!location.hostname.endsWith("discord.com")) {
    alert("Run this on discord.com (e.g. https://discord.com/app).");
    return;
  }

  function safeWebStorage(which) {
    try {
      if (typeof window === "undefined") return null;
      const s = window[which];
      if (!s || typeof s.getItem !== "function") return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function storageOrTop(which) {
    const local = safeWebStorage(which);
    if (local) return local;
    try {
      const top = window.top;
      if (!top || top === window) return null;
      const s = top[which];
      if (!s || typeof s.getItem !== "function") return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function unwrap(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1);
    }
    return s || null;
  }

  function looksLikeDiscordUserToken(s) {
    if (!s || s.length < 40) return false;
    if (/^[\\w-]+\\.[\\w-]+\\.[\\w-]+$/.test(s)) return true;
    if (/^mfa\\.[\\w-]+$/i.test(s)) return true;
    return /^[A-Za-z0-9._-]+$/.test(s) && s.length >= 59;
  }

  function tryStorage(store) {
    if (!store || typeof store.getItem !== "function") return null;
    try {
      const direct = unwrap(store.getItem("token"));
      if (direct && looksLikeDiscordUserToken(direct)) return direct;
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        if (!/token/i.test(k)) continue;
        const v = unwrap(store.getItem(k));
        if (v && looksLikeDiscordUserToken(v)) return v;
      }
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        const v = unwrap(store.getItem(k));
        if (v && /^[\\w-]+\\.[\\w-]+\\.[\\w-]+$/.test(v)) return v;
      }
    } catch (_) {}
    return null;
  }

  function tryWebpack() {
    try {
      const chunk = window.webpackChunkdiscord_app;
      if (!chunk || typeof chunk.push !== "function") return null;
      let token = null;
      chunk.push([
        [Math.random().toString(36).slice(2)],
        {},
        function (req) {
          try {
            const c = req.c || {};
            for (const id of Object.keys(c)) {
              const m = c[id].exports;
              if (!m) continue;
              if (m.default && typeof m.default.getToken === "function") {
                const t = m.default.getToken();
                if (typeof t === "string" && looksLikeDiscordUserToken(t)) token = t;
              }
              if (token) break;
              for (const k of Object.keys(m)) {
                const v = m[k];
                if (v && typeof v.getToken === "function") {
                  const t = v.getToken();
                  if (typeof t === "string" && looksLikeDiscordUserToken(t)) {
                    token = t;
                    break;
                  }
                }
              }
              if (token) break;
            }
          } catch (_) {}
        },
      ]);
      chunk.pop();
      return token;
    } catch (_) {
      return null;
    }
  }

  const token =
    tryStorage(storageOrTop("localStorage")) ||
    tryStorage(storageOrTop("sessionStorage")) ||
    tryWebpack();

  if (!token) {
    alert(
      "Could not find a token automatically. Open Application → Storage → Local Storage for discord.com and look for a key named token, or fully load discord.com/app and run this again."
    );
    return;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  const copied = await copyToClipboard(token);
  if (copied) {
    alert("Discord token copied to clipboard.");
  } else {
    window.prompt("Clipboard blocked — copy this token manually (Ctrl+C then Enter):", token);
  }
})().catch(function (err) {
  console.error(err);
  alert(
    "discordCopyToken failed: " +
      (err && err.message ? err.message : String(err)) +
      ". In DevTools Console, pick the top frame (discord.com) in the context dropdown and try again."
  );
});

`;
