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
    <div className="w-[681px] inline-flex flex-col justify-start items-start gap-6">
      <div className="self-stretch flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-start gap-6">
          <div className="flex-1 inline-flex flex-col justify-start items-start gap-2">
            <Tabs defaultValue="edit" className="w-full">
              <div className="self-stretch inline-flex justify-between items-center">
                <div className="justify-start text-black text-base font-normal font-['Inter'] leading-normal">
                  Exclusive Content for Participants
                </div>

                <TabsList className="p-1 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-[rgba(0,0,0,0.15)] flex justify-start items-start h-auto gap-0">
                  <TabsTrigger
                    value="edit"
                    className="px-6 py-1.5 rounded-lg flex justify-center items-center gap-2 text-xs font-medium font-['Inter'] leading-none text-black h-auto data-[state=active]:bg-[#fbfcfe] data-[state=active]:outline data-[state=active]:outline-1 data-[state=active]:outline-offset-[-1px] data-[state=active]:outline-[rgba(0,0,0,0.15)] data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:outline-transparent data-[state=inactive]:font-normal"
                  >
                    Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="px-4 py-1.5 rounded-[100px] flex justify-center items-center gap-2 text-xs font-medium font-['Inter'] leading-none text-black h-auto data-[state=active]:bg-[#fbfcfe] data-[state=active]:outline data-[state=active]:outline-1 data-[state=active]:outline-offset-[-1px] data-[state=active]:outline-[rgba(0,0,0,0.15)] data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:outline-transparent data-[state=inactive]:font-normal"
                  >
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="edit" className="mt-2">
                <div className="self-stretch h-72 px-3 py-2 bg-white rounded-xl outline outline-1 outline-[rgba(0,0,0,0.15)] inline-flex justify-start items-start gap-3">
                  <textarea
                    id="paywall_content"
                    value={event.paywall_content || ""}
                    disabled={isArchived}
                    onChange={(e) =>
                      setEvent({ ...event, paywall_content: e.target.value })
                    }
                    placeholder="Add content (markdown supported)"
                    className="flex-1 resize-none justify-start text-[rgba(0,0,0,0.6)] text-base font-normal font-['Inter'] leading-normal bg-transparent border-none outline-none focus:outline-none"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-2">
                <div className="self-stretch min-h-72 px-3 py-2 bg-white rounded-xl outline outline-1 outline-[rgba(0,0,0,0.15)] inline-flex justify-start items-start gap-3">
                  <div className="prose prose-sm dark:prose-invert max-w-none flex-1 text-base font-normal font-['Inter'] leading-normal text-black">
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

        <div className="self-stretch justify-start text-[#7f7f7f] text-base font-normal font-['Inter'] leading-normal">
          *This content is visible only to participants who have joined the event.
        </div>
      </div>
    </div>
  );
}
