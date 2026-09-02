import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api, tokenStore, type User } from "./api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    let alive = true;
    api
      .me(token)
      .then((me) => {
        if (!alive) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!alive) return;
        tokenStore.clear();
        setStatus("anonymous");
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    tokenStore.set(session.token);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, isAdmin: user?.role === "admin", login, logout }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
