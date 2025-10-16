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
        <div className="min-h-screen flex bg-[#fbfcfe]">
          {/* Desktop Sidebar - Hidden on mobile, fixed position, positioned below navbar */}
          <aside className="hidden lg:block bg-[#fbfcfe] flex-shrink-0 fixed left-0 top-[72px] h-[calc(100vh-72px)] overflow-y-auto">
            <SideNav />
          </aside>

          {/* Main content with left margin to account for fixed sidebar and top padding for navbar */}
          <main className="flex-1 lg:ml-[var(--sidebar-width,280px)] pt-[16px] overflow-y-auto overscroll-y-contain">
            {children}
          </main>
        </div>
      ) : (
        <div className="min-h-screen w-full">{children}</div>
      )}
    </>
  );
}
