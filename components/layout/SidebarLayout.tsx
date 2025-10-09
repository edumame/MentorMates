"use client";

import React, { useEffect, useState } from "react";
import { SideNav } from "@/components/heroes/components/SideNav";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(session);
        setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <>
      {session ? (
        <div className="min-h-screen flex">
          {/* Desktop Sidebar - Hidden on mobile, fixed position (offset below banner + navbar) */}
          <aside
            className="hidden lg:block bg-white flex-shrink-0 fixed left-0 overflow-y-auto pt-5"
            style={{
              top: "calc(var(--banner-h, 0px) + 64px)",
              height: "calc(100vh - var(--banner-h, 0px) - 64px)",
            }}
          >
            <SideNav />
          </aside>

          {/* Main content with left margin to account for fixed sidebar */}
          <main className="flex-1 overflow-y-auto lg:ml-[var(--sidebar-width,280px)] pt-5">
            {children}
          </main>
        </div>
      ) : (
        <div className="min-h-screen flex">
          {children}
        </div>
      )}
    </>
  );
}
