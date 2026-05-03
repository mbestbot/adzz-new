"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import "./email.css";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function GenerateEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setError(null);
    setEmail(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-email`);
      const data = (await res.json()) as { email?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.email) setEmail(data.email);
      else setError("No email in response");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the service. Is it running?"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="email-tool">
      <p className="email-tool-back">
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Random test email</h1>
      <p className="email-tool-sub">
        Creates a disposable address you can use for signups and tests. Your
        server must be configured with the right credentials for this to work.
      </p>
      <button type="button" onClick={generate} disabled={loading}>
        {loading ? "Generating…" : "Generate"}
      </button>
      {email ? <div className="email-tool-result">{email}</div> : null}
      {error ? <div className="email-tool-error">{error}</div> : null}
    </main>
  );
}
