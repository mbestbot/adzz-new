"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LandingNav } from "@/components/landing/LandingNav";
import layoutStyles from "./authLayout.module.css";

function navCurrent(pathname: string | null) {
  if (!pathname) return null;
  if (pathname.includes("/auth/signup")) return "signup" as const;
  if (pathname.includes("/auth/login")) return "login" as const;
  return null;
}

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = navCurrent(pathname);

  return (
    <div className={layoutStyles.authPage}>
      <div className={layoutStyles.gradientBg} aria-hidden />
      <div className={layoutStyles.inner}>
        <LandingNav current={current} />
        <main className={layoutStyles.main}>{children}</main>
      </div>
    </div>
  );
}
