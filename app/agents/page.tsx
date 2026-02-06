import { Bot } from "lucide-react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { AgentsTab } from "@/features/user/dashboards/dashboard/organizer/agents/AgentsTab";

export default function AgentsPage() {
  return (
    <PageContainer>
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col gap-[24px] px-[32px]">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-black" />
            <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
              Agents
            </h1>
          </div>
          <AgentsTab />
        </div>
      </PageContent>
    </PageContainer>
  );
}
