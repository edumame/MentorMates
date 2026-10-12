import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 bg-gray-50">
      <SidebarLayout showLogoInSidebar>{children}</SidebarLayout>
    </div>
  );
}
