import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}