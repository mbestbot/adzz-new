"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getAdminToken } from "@/lib/adminToken";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [isLogin, router]);

  if (!ready && !isLogin) {
    return (
      <p style={{ padding: "2rem", fontFamily: "system-ui", color: "#64748b" }}>
        Checking admin session…
      </p>
    );
  }

  return <>{children}</>;
}
