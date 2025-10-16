"use client";

import { EventDetails } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ContentTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived?: boolean;
}

export function ContentTab({ event, setEvent, isArchived = false }: ContentTabProps) {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start w-full">
      <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
        <div className="basis-0 content-stretch flex flex-col gap-[8px] grow items-start min-h-px min-w-px relative shrink-0">
          <Tabs defaultValue="edit" className="w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['Inter'] font-normal leading-[1.5] not-italic relative shrink-0 text-[16px] text-black text-nowrap whitespace-pre">
                Exclusive Content for Participants
              </p>
              <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] border-solid box-border content-stretch flex items-start p-[4px] relative rounded-[12px] shrink-0 h-auto gap-0">
                <TabsTrigger
                  value="edit"
                  className="px-[24px] py-[6px] rounded-[8px] gap-[8px] text-[12px] leading-[1.5] h-auto font-['Inter'] text-black data-[state=active]:bg-[#fbfcfe] data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:border-solid data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-[rgba(255,255,255,0)] data-[state=inactive]:border data-[state=inactive]:border-[rgba(255,255,255,0)] data-[state=inactive]:border-solid data-[state=inactive]:font-normal"
                >
                  Edit
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="px-[16px] py-[6px] rounded-[100px] gap-[8px] text-[12px] leading-[1.5] h-auto font-['Inter'] text-black data-[state=active]:bg-[#fbfcfe] data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:border-solid data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-[rgba(255,255,255,0)] data-[state=inactive]:border data-[state=inactive]:border-[rgba(255,255,255,0)] data-[state=inactive]:border-solid data-[state=inactive]:font-normal"
                >
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="edit" className="mt-0">
              <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid box-border content-stretch flex gap-[12px] h-[299px] items-start px-[12px] py-[8px] relative rounded-[12px] shrink-0 w-full">
                <textarea
                  id="paywall_content"
                  value={event.paywall_content || ""}
                  disabled={isArchived}
                  onChange={(e) =>
                    setEvent({ ...event, paywall_content: e.target.value })
                  }
                  placeholder="Add content (markdown supported)"
                  className="basis-0 font-['Inter'] font-normal grow leading-[1.5] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-[rgba(0,0,0,0.6)] bg-transparent border-none outline-none focus:outline-none resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid box-border content-stretch flex gap-[12px] min-h-[299px] items-start px-[12px] py-[8px] relative rounded-[12px] shrink-0 w-full">
                <div className="prose prose-sm dark:prose-invert max-w-none basis-0 font-['Inter'] font-normal grow leading-[1.5] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-black">
                  <ReactMarkdown
                    rehypePlugins={markdownRehypePlugins}
                    components={customMarkdownComponents}
                  >
                    {event.paywall_content || ""}
                  </ReactMarkdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <p className="font-['Inter'] font-normal leading-[1.5] not-italic relative shrink-0 text-[#7f7f7f] text-[16px] w-full">
        *This content is visible only to participants who have joined/paid for the event.
      </p>
    </div>
  );
}
