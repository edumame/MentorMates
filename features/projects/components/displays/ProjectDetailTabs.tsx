import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/** Common read-only navigation; scoring remains an access-controlled judge tool. */
export function ProjectDetailTabs({ hasTracks, totalMembers, feedbackCount, isJudge = false }: {
  hasTracks: boolean; totalMembers: number; feedbackCount: number; isJudge?: boolean;
}) {
  const tabs = [{ value: "overview", label: "Overview" }, ...(hasTracks ? [{ value: "tracks", label: "Tracks" }] : []),
    { value: "team", label: "Team", count: totalMembers }, { value: "feedback", label: "Feedback", count: feedbackCount },
    ...(isJudge ? [{ value: "scoring", label: "Judge Scoring" }] : []), { value: "sharing", label: "Sharing" }];
  return <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 w-full justify-start gap-3 sm:gap-6 overflow-x-auto scrollbar-hide flex-nowrap">
    {tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 font-medium flex items-center gap-2">
      {tab.label}{"count" in tab && <Badge variant="secondary" className="bg-white border border-black/15 text-black rounded-full text-xs">{tab.count}</Badge>}
    </TabsTrigger>)}
  </TabsList>;
}
