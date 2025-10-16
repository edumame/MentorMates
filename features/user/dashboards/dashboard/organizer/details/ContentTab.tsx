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
    <div className="flex flex-col gap-[24px] items-start w-full">
      {/* Input Container */}
      <div className="flex flex-col gap-[16px] items-start w-full">
        {/* Input Wrapper */}
        <div className="flex gap-[24px] items-start w-full">
          {/* Input Field */}
          <div className="flex-1 flex flex-col gap-[8px] min-w-0">
            <Tabs defaultValue="edit" className="w-full">
              {/* Header with Toggle */}
              <div className="flex items-center justify-between w-full">
                <p className="font-normal text-[16px] leading-[1.5] text-black whitespace-pre">
                  Exclusive Content for Participants
                </p>

                {/* Edit/Preview Toggle using Shadcn Tabs */}
                <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] p-[4px] h-auto gap-0 shrink-0">
                  <TabsTrigger
                    value="edit"
                    className="px-[24px] py-[6px] h-auto rounded-[8px] text-[12px] leading-[18px] text-black data-[state=active]:bg-[#fbfcfe] data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:border-solid data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:border-transparent data-[state=inactive]:font-normal"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="px-[16px] py-[6px] h-auto rounded-[100px] text-[12px] leading-[18px] text-black data-[state=active]:bg-[#fbfcfe] data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:border-solid data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:border-transparent data-[state=inactive]:font-normal"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Text Input Area */}
              <TabsContent value="edit" className="mt-[8px]">
                <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] h-[299px] px-[12px] py-[8px] w-full">
                  <textarea
                    id="paywall_content"
                    value={event.paywall_content || ""}
                    disabled={isArchived}
                    onChange={(e) =>
                      setEvent({ ...event, paywall_content: e.target.value })
                    }
                    placeholder="Add content (markdown supported)"
                    className="w-full h-full resize-none font-normal text-[16px] leading-[1.5] text-black placeholder:text-[rgba(0,0,0,0.6)] bg-transparent border-none outline-none focus:outline-none"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
              </TabsContent>

              {/* Preview Area */}
              <TabsContent value="preview" className="mt-[8px]">
                <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] min-h-[299px] px-[12px] py-[8px] w-full">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-[16px] leading-[1.5] text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
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

        {/* Helper Text */}
        <p className="font-normal text-[16px] leading-[1.5] text-[#7f7f7f] w-full">
          *This content is visible only to participants who have joined the event.
        </p>
      </div>
    </div>
  );
}
