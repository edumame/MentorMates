import React from "react";
import { SideNav } from "@/components/heroes/components/SideNav";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:block bg-white flex-shrink-0">
        <SideNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
