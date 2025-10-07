import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthNavbar />
      <div className="pt-16">
        <SidebarLayout>{children}</SidebarLayout>
      </div>
    </div>
  );
}
