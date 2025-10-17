import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 bg-white">
      <div>
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
