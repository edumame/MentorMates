import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { StaticPageFrame } from "@/components/layout/StaticPageFrame";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <ConditionalNavbar />
      <div className="pt-2">
        <SidebarLayout showLogoInSidebar>
          <StaticPageFrame>{children}</StaticPageFrame>
        </SidebarLayout>
      </div>
    </div>
  );
}