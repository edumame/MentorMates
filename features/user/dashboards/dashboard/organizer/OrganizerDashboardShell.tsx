"use client";

import type { ReactNode } from "react";
import {
  Bell,
  Bot,
  Calendar,
  DollarSign,
  FileText,
  FolderKanban,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type OrganizerDashboardTab = {
  value: string;
  label: string;
  icon: LucideIcon;
};

export type OrganizerDashboardSubTab = {
  value: string;
  label: string;
};

export const ORGANIZER_PRIMARY_TABS: OrganizerDashboardTab[] = [
  { value: "overview", label: "Overview", icon: Sparkles },
  { value: "registration", label: "Registration", icon: Calendar },
  { value: "project", label: "Project", icon: FileText },
  { value: "access", label: "Access", icon: Shield },
  { value: "tracks", label: "Tracks", icon: FolderKanban },
  { value: "pricing", label: "Pricing", icon: DollarSign },
  { value: "notify", label: "Notify", icon: Bell },
  { value: "agents", label: "Agents", icon: Bot },
];

export const ORGANIZER_OVERVIEW_SUB_TABS: OrganizerDashboardSubTab[] = [
  { value: "basics", label: "Basics" },
  { value: "content", label: "Content" },
  { value: "schedule", label: "Schedule" },
  { value: "resources", label: "Resources" },
  { value: "rules", label: "Rules" },
  { value: "faqs", label: "FAQs" },
  { value: "gallery", label: "Gallery" },
];

type OrganizerDashboardShellProps = {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  activeSubTab: string;
  onActiveSubTabChange: (value: string) => void;
  isAdmin: boolean;
  overviewContent: ReactNode;
  registrationContent: ReactNode;
  projectContent: ReactNode;
  accessContent: ReactNode;
  tracksContent: ReactNode;
  pricingContent?: ReactNode;
  notifyContent: ReactNode;
  agentsContent: ReactNode;
};

export function OrganizerDashboardShell({
  activeTab,
  onActiveTabChange,
  activeSubTab,
  onActiveSubTabChange,
  isAdmin,
  overviewContent,
  registrationContent,
  projectContent,
  accessContent,
  tracksContent,
  pricingContent = null,
  notifyContent,
  agentsContent,
}: OrganizerDashboardShellProps) {
  const primaryTabs = ORGANIZER_PRIMARY_TABS.filter((tab) =>
    tab.value === "pricing" ? isAdmin : true
  );

  return (
    <PageContainer>
      <PageContent className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1064px] flex-col gap-12">
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={onActiveTabChange}>
              <div className="-mx-2 mb-6 overflow-x-auto pb-2 sm:mx-0 sm:overflow-visible">
                <TabsList className="flex h-auto min-w-full gap-2 overflow-x-auto rounded-none bg-transparent p-0 sm:min-w-0 sm:flex-wrap sm:rounded-lg sm:bg-muted sm:p-1">
                  {primaryTabs.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      title={item.label}
                      className="flex-shrink-0 gap-2 px-4 py-2 text-sm font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0">
                <Tabs value={activeSubTab} onValueChange={onActiveSubTabChange}>
                  <TabsList className="mb-6 flex h-auto gap-2 overflow-x-auto rounded-lg border-b border-gray-200 bg-transparent p-0">
                    {ORGANIZER_OVERVIEW_SUB_TABS.map((subTab) => (
                      <TabsTrigger
                        key={subTab.value}
                        value={subTab.value}
                        className="border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-[#4b89ef]"
                      >
                        {subTab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value={activeSubTab} className="mt-0">
                    {overviewContent}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="registration" className="mt-0">
                {registrationContent}
              </TabsContent>

              <TabsContent value="project" className="mt-0">
                {projectContent}
              </TabsContent>

              {isAdmin ? (
                <TabsContent value="pricing" className="mt-0">
                  {pricingContent}
                </TabsContent>
              ) : null}

              <TabsContent value="access" className="mt-0">
                {accessContent}
              </TabsContent>

              <TabsContent value="tracks" className="mt-0">
                {tracksContent}
              </TabsContent>

              <TabsContent value="notify" className="mt-0">
                {notifyContent}
              </TabsContent>

              <TabsContent value="agents" className="mt-0">
                {agentsContent}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}
