import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Adzz — Discord ad automation",
  description:
    "Unlimited ad bots, ad pool, campaigns, analytics, and multi-channel Discord messaging. Adzz Pro and Adzz Business.",
};

export default function Home() {
  return <LandingPage />;
}
