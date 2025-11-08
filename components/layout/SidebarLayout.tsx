"use client";

import React from "react";
import { SideNav } from "@/components/heroes/components/SideNav";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated ? (
        <div className="fixed top-[72px] left-0 right-0 bottom-0 flex bg-[#fbfcfe] overflow-hidden">
          {/* Desktop Sidebar - Hidden on mobile, fixed position, positioned below navbar */}
          <aside className="hidden lg:block bg-[#fbfcfe] flex-shrink-0 fixed left-0 top-[72px] h-[calc(100vh-72px)] overflow-y-auto z-10">
            <SideNav />
          </aside>

          {/* Main content with left margin to account for fixed sidebar and top padding for navbar */}
          <main className="relative z-20 flex-1 min-h-0 lg:ml-[var(--sidebar-width,280px)] pt-[16px] overflow-hidden">
            {children}
          </main>
        </div>
      ) : (
        <div className="h-full w-full overflow-auto">{children}</div>
      )}
    </>
  );
}
