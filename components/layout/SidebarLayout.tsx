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
        <div className="min-h-screen flex">
          {/* Desktop Sidebar - Hidden on mobile, fixed position */}
          <aside className="hidden lg:block bg-white flex-shrink-0 fixed left-0 top-0 h-screen overflow-y-auto pt-5">
            <SideNav />
          </aside>

          {/* Main content with left margin to account for fixed sidebar */}
          <main className="flex-1 lg:ml-[var(--sidebar-width,280px)] pt-5 overflow-y-auto overscroll-y-contain">
            {children}
          </main>
        </div>
      ) : (
        <div className="min-h-screen w-full">{children}</div>
      )}
    </>
  );
}
