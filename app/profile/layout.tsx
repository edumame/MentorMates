import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-2">
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
