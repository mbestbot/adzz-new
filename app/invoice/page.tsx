"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import "../generate-email/email.css";
import "./invoice.css";

type CreateInvoiceResponse = {
  hostedInvoiceUrl?: string;
  invoiceId?: string;
  invoiceNumber?: string | null;
  amountUsd?: number;
  currency?: string;
  status?: string | null;
  dueDate?: string | null;
  invoicePdf?: string;
  error?: string;
};

export default function InvoicePage() {
  const { user, loading: authLoading } = useAuth();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerBusinessName, setPayerBusinessName] = useState("");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [payerTaxIdType, setPayerTaxIdType] = useState<string>("us_ein");
  const [payerTaxIdTypeCustom, setPayerTaxIdTypeCustom] = useState("");
  const [result, setResult] = useState<CreateInvoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const createInvoice = useCallback(async () => {
    setError(null);
    setResult(null);
    setCopyHint(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/stripe/create-shareable-invoice", {
        method: "POST",
        body: JSON.stringify({
          amount: amount.trim(),
          description: description.trim() || undefined,
          payerEmail: payerEmail.trim() || undefined,
          payerBusinessName: payerBusinessName.trim() || undefined,
          payerTaxId: payerTaxId.trim() || undefined,
          payerTaxIdType:
            payerTaxIdType === "custom"
              ? payerTaxIdTypeCustom.trim() || "us_ein"
              : payerTaxIdType,
        }),
      });
      const data = (await res.json()) as CreateInvoiceResponse;
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the API. Is it running?"
      );
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    description,
    payerEmail,
    payerBusinessName,
    payerTaxId,
    payerTaxIdType,
    payerTaxIdTypeCustom,
  ]);

  const copyLink = useCallback(async () => {
    const url = result?.hostedInvoiceUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyHint("Link copied to clipboard.");
      setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint("Could not copy — select the link and copy manually.");
    }
  }, [result?.hostedInvoiceUrl]);

  return (
    <main className="email-tool">
      <p className="email-tool-back">
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Shareable Stripe invoice</h1>
      <p className="email-tool-sub">
        Enter an amount in USD. We create a real Stripe invoice and a hosted
        payment page you can send to anyone — they do not need an Adzz
        account. You must be signed in to generate invoices (abuse protection).
      </p>

      {authLoading ? (
        <p className="email-tool-sub">Checking session…</p>
      ) : !user ? (
        <div className="invoice-tool-login">
          <strong>Sign in required.</strong>{" "}
          <Link href="/auth/login">Log in</Link> or{" "}
          <Link href="/auth/signup">create an account</Link>, then return here.
        </div>
      ) : (
        <>
          <div className="invoice-tool-row">
            <label htmlFor="inv-amount">Amount (USD)</label>
            <input
              id="inv-amount"
              className="invoice-tool-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 25 or 19.99"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="invoice-tool-hint">Minimum $1.00. Maximum $999,999.99.</p>
          </div>
          <div className="invoice-tool-row">
            <label htmlFor="inv-desc">Description (optional)</label>
            <textarea
              id="inv-desc"
              className="invoice-tool-textarea"
              placeholder="Shown on the Stripe invoice"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="invoice-tool-row">
            <label htmlFor="inv-payer">Payer email (optional)</label>
            <input
              id="inv-payer"
              className="invoice-tool-input"
              type="email"
              autoComplete="email"
              placeholder="Prefills Stripe’s receipt field when present"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
            />
          </div>
          <div className="invoice-tool-row">
            <label htmlFor="inv-biz">Payer business name (optional)</label>
            <input
              id="inv-biz"
              className="invoice-tool-input"
              type="text"
              autoComplete="organization"
              placeholder="Legal or billing name on the invoice"
              value={payerBusinessName}
              onChange={(e) => setPayerBusinessName(e.target.value)}
              maxLength={150}
            />
          </div>
          <div className="invoice-tool-row">
            <label htmlFor="inv-tax-type">Payer tax ID type (optional)</label>
            <select
              id="inv-tax-type"
              className="invoice-tool-input"
              value={payerTaxIdType}
              onChange={(e) => setPayerTaxIdType(e.target.value)}
              aria-describedby="inv-tax-hint"
            >
              <option value="us_ein">US — EIN (us_ein)</option>
              <option value="eu_vat">
                EU — VAT (eu_vat), include country code (e.g. RO…, DE…)
              </option>
              <option value="ro_tin">Romania — TIN (ro_tin)</option>
              <option value="gb_vat">UK — VAT (gb_vat)</option>
              <option value="ca_bn">Canada — Business Number (ca_bn)</option>
              <option value="au_abn">Australia — ABN (au_abn)</option>
              <option value="mx_rfc">Mexico — RFC (mx_rfc)</option>
              <option value="custom">Other (Stripe type slug)…</option>
            </select>
            <p id="inv-tax-hint" className="invoice-tool-hint">
              Only used if you enter a tax ID below. For <strong>EU VAT</strong>, type
              the full ID with the country prefix (e.g. <strong>RO53679159</strong> for
              Romania) — digits alone can show as the wrong country (e.g. HU VAT). See
              Stripe’s{" "}
              <a
                href="https://docs.stripe.com/api/customers/create#create_customer-tax_id_data-type"
                target="_blank"
                rel="noopener noreferrer"
              >
                customer tax ID types
              </a>
              .
            </p>
            {payerTaxIdType === "custom" ? (
              <input
                className="invoice-tool-input"
                style={{ marginTop: "0.5rem" }}
                type="text"
                placeholder="e.g. de_stn, jp_cn"
                value={payerTaxIdTypeCustom}
                onChange={(e) => setPayerTaxIdTypeCustom(e.target.value)}
                maxLength={32}
                autoComplete="off"
              />
            ) : null}
          </div>
          <div className="invoice-tool-row">
            <label htmlFor="inv-tax-id">Payer tax ID (optional)</label>
            <input
              id="inv-tax-id"
              className="invoice-tool-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder={
                payerTaxIdType === "eu_vat"
                  ? "e.g. RO53679159 (RO + number for Romania)"
                  : payerTaxIdType === "ro_tin"
                    ? "Romania TIN as issued (ro_tin)"
                    : "Digits / letters as issued (spaces stripped when sent)"
              }
              value={payerTaxId}
              onChange={(e) => setPayerTaxId(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="invoice-tool-actions">
            <button type="button" onClick={createInvoice} disabled={loading}>
              {loading ? "Creating…" : "Create invoice & link"}
            </button>
          </div>
        </>
      )}

      {result?.hostedInvoiceUrl ? (
        <>
          <div className="email-tool-result">{result.hostedInvoiceUrl}</div>
          <div className="invoice-tool-link-row">
            <button
              type="button"
              className="invoice-tool-btn-secondary"
              onClick={() => void copyLink()}
            >
              Copy payment link
            </button>
            <a
              href={result.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open hosted invoice →
            </a>
          </div>
          {copyHint ? (
            <p className="invoice-tool-meta" style={{ color: "var(--dash-green)" }}>
              {copyHint}
            </p>
          ) : null}
          <div className="invoice-tool-meta">
            {result.invoiceNumber != null && result.invoiceNumber !== ""
              ? `Invoice #${result.invoiceNumber} · `
              : null}
            {result.invoiceId ? `Stripe id ${result.invoiceId}` : null}
            {result.amountUsd != null ? ` · $${result.amountUsd.toFixed(2)} USD` : null}
            {result.dueDate
              ? ` · Due ${new Date(result.dueDate).toLocaleDateString()}`
              : null}
          </div>
          {result.invoicePdf ? (
            <div className="invoice-tool-link-row">
              <a href={result.invoicePdf} target="_blank" rel="noopener noreferrer">
                Download PDF →
              </a>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <div className="email-tool-error">{error}</div> : null}
    </main>
  );
}
