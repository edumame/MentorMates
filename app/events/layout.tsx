import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div>
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
