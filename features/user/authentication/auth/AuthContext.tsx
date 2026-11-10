"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render must agree. Supabase owns session persistence;
  // reading a second browser-only cache here changes the entire layout during hydration.
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let authEventReceived = false;
    // Clear the obsolete duplicate cache, which could outlive a Supabase sign-out.
    try { sessionStorage.removeItem("supabase_session"); } catch { /* Storage may be unavailable. */ }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authEventReceived = true;
      if (isMounted) {
        setSession(newSession);
        setIsLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      // A later sign-in/sign-out event supersedes this older asynchronous lookup.
      if (isMounted && !authEventReceived) {
        setSession(error ? null : data.session);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted && !authEventReceived) {
        setSession(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    isLoading,
    isAuthenticated: !!session,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
}
