"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getStoredToken, setStoredToken } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  discordId?: string | null;
  discordUsername?: string | null;
  discordAvatar?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<void>;
  signup: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) {
      setStoredToken(null);
      setUser(null);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: AuthUser;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      if (!data.token || !data.user) throw new Error("Invalid response");
      setStoredToken(data.token, { remember });
      setUser(data.user);
    },
    []
  );

  const signup = useCallback(
    async (email: string, password: string, remember = true) => {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: AuthUser;
        error?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && data.retryAfterSeconds != null) {
          const mins = Math.max(1, Math.ceil(data.retryAfterSeconds / 60));
          throw new Error(
            data.error ??
              `Too many sign-up attempts from this network. Try again in about ${mins} minute(s).`
          );
        }
        throw new Error(data.error ?? "Sign up failed");
      }
      if (!data.token || !data.user) throw new Error("Invalid response");
      setStoredToken(data.token, { remember });
      setUser(data.user);
    },
    []
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      refreshMe,
    }),
    [user, loading, login, signup, logout, refreshMe]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--dash-muted)",
          fontSize: "0.9rem",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
