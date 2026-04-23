import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function KeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout showLogoInSidebar>{children}</SidebarLayout>;
}
