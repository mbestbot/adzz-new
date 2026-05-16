import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Shareable invoice",
  description:
    "Create a Stripe invoice and hosted payment link you can send to anyone.",
};

export default function InvoiceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
