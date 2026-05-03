"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setStoredToken } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import { OAuthCompleteCard } from "@/components/auth/discord/OAuthCompleteCard";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Sign-in session expired. Try again.",
  token_exchange_failed: "Could not complete Discord sign-in.",
  discord_profile: "Could not read your Discord profile.",
  oauth_not_configured: "Discord sign-in is not configured on the server.",
  network: "Network error. Check your connection and try again.",
  email_in_use:
    "That email is already registered with a different sign-in method.",
  discord_mismatch:
    "This Discord account does not match the account linked to that email.",
  user_missing: "Something went wrong creating your session.",
  access_denied: "Discord sign-in was cancelled.",
  link_user_missing: "Your link session expired. Open Account settings and try again.",
  discord_account_in_use:
    "That Discord account is already linked to a different Adzz user.",
};

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.includes(":")) return "/dashboard";
  return raw.length > 200 ? "/dashboard" : raw;
}

export default function DiscordAuthCompletePage() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorExtras, setErrorExtras] = useState<{ href: string; label: string }[]>(
    []
  );

  useEffect(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const err = params.get("error");
    const token = params.get("token");
    const nextRaw = params.get("next");

    if (err) {
      setErrorText(ERROR_MESSAGES[err] ?? err.replace(/_/g, " "));
      setErrorExtras([{ href: "/settings", label: "Account settings" }]);
      return;
    }

    if (!token) {
      setErrorText(
        "Missing sign-in token. Close this tab and start again from the app."
      );
      setErrorExtras([]);
      return;
    }

    const dest = safeNextPath(nextRaw);

    setStoredToken(token, { remember: true });
    refreshMe()
      .then(() => {
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(dest);
      })
      .catch(() => {
        setErrorText("Could not load your account. Try signing in again.");
        setErrorExtras([]);
      });
  }, [router, refreshMe]);

  if (errorText) {
    return (
      <OAuthCompleteCard
        mode="error"
        title="Discord"
        description="Something went wrong completing the request."
        errorText={errorText}
        extraActions={errorExtras}
      />
    );
  }

  return (
    <OAuthCompleteCard
      mode="loading"
      title="Almost there"
      description="We are finishing connecting your Discord account."
    />
  );
}
