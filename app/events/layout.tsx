import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout showLogoInSidebar>{children}</SidebarLayout>;
}
