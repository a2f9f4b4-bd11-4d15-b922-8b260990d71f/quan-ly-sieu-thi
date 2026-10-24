"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, logout as apiLogout } from "@/lib/api/client";
import { getSession, subscribeToSession, type Session } from "@/lib/api/session";
import { homeRouteFor } from "./permissions";

type AuthValue = {
  user: Session["user"] | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSessionState(getSession());
    setHydrated(true);
    return subscribeToSession(setSessionState);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      // Before hydration we do not yet know; treat as authenticated so the
      // app shell does not bounce a logged-in user to /login on first paint.
      isAuthenticated: hydrated ? Boolean(session) : true,
      async login(username, password) {
        const next = await apiLogin(username, password);
        router.push(homeRouteFor(next.user.role));
      },
      async logout() {
        await apiLogout();
        router.push("/login");
      },
    }),
    [session, hydrated, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
