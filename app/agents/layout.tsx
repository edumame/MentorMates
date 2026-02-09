import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
