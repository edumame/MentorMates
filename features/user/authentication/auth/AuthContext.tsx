"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "supabase_session";

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  // Initialize from sessionStorage to prevent flash
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsedSession = JSON.parse(stored);
        // Check if session is still valid (not expired)
        if (parsedSession?.expires_at && new Date(parsedSession.expires_at * 1000) > new Date()) {
          return parsedSession;
        }
      }
    } catch (error) {
      console.error("Error loading session from storage:", error);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Store session in sessionStorage
  const storeSession = useCallback((session: Session | null) => {
    if (typeof window === "undefined") return;

    try {
      if (session) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error storing session:", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (isMounted) {
          if (error) {
            console.error("Error getting session:", error);
            setSession(null);
            storeSession(null);
          } else {
            setSession(currentSession);
            storeSession(currentSession);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (isMounted) {
          setSession(null);
          storeSession(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        storeSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [storeSession]);

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
