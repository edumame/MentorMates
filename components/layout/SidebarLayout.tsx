import React from "react";
import { SideNav } from "@/components/heroes/components/SideNav";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <div className="min-h-screen flex pt-5">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:block bg-white border-r border-gray-200 flex-shrink-0">
        <SideNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
