import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="pt-2">
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}