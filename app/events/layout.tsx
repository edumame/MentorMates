import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <AuthNavbar />
      <div>
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
