/** Shown in admin for operators to copy — user tokens change when Discord updates their web app. */
export const DISCORD_USER_TOKEN_EXTRACTION_SCRIPT = `// Paste in DevTools → Console on https://discord.com/app while logged in.
// WARNING: A user token is a password for the account. Never paste it in untrusted sites.
// For BOT tokens, use https://discord.com/developers/applications → Your app → Bot → Reset Token.

(function () {
  try {
    const raw = localStorage.getItem("token");
    if (raw) {
      const t = raw.replace(/^"(.*)"$/, "$1");
      if (t && t.length > 20) {
        console.log("Token:\\n" + t);
        return t;
      }
    }
  } catch (e) {
    console.warn(e);
  }
  console.warn(
    "Could not read token from localStorage. Discord may have moved it; search for an updated snippet or use a bot token from the Developer Portal."
  );
})();

`;
