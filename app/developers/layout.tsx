import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout showLogoInSidebar>{children}</SidebarLayout>;
}
