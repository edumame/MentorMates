import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <ConditionalNavbar />
      <div>
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
