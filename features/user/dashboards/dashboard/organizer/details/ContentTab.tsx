"use client";

import { useState } from "react";
import { EventDetails } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";

interface ContentTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived?: boolean;
}

export function ContentTab({ event, setEvent, isArchived = false }: ContentTabProps) {
  const [activeMode, setActiveMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="flex flex-col gap-[16px] w-full">
      {/* Input Section */}
      <div className="flex flex-col gap-[8px] w-full">
        {/* Header with Toggle */}
        <div className="flex items-center justify-between w-full">
          <p className="font-['Inter'] font-normal text-[16px] leading-[1.5] text-black">
            Exclusive Content for Participants
          </p>

          {/* Edit/Preview Toggle */}
          <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] p-[4px] flex items-start">
            <button
              type="button"
              onClick={() => setActiveMode("edit")}
              className={`flex gap-[8px] items-center justify-center px-[24px] py-[6px] rounded-[8px] text-[12px] leading-[1.5] transition-colors ${
                activeMode === "edit"
                  ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] border-solid font-medium text-black"
                  : "bg-transparent border border-transparent font-normal text-black"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("preview")}
              className={`flex gap-[8px] items-center justify-center px-[16px] py-[6px] rounded-[100px] text-[12px] leading-[1.5] transition-colors ${
                activeMode === "preview"
                  ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] border-solid font-medium text-black"
                  : "bg-transparent border border-transparent font-normal text-black"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Text Input / Preview Area */}
        {activeMode === "edit" ? (
          <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] h-[299px] px-[12px] py-[8px] w-full">
            <textarea
              id="paywall_content"
              value={event.paywall_content || ""}
              disabled={isArchived}
              onChange={(e) =>
                setEvent({ ...event, paywall_content: e.target.value })
              }
              placeholder="Add content (markdown supported)"
              className="w-full h-full resize-none font-['Inter'] font-normal text-[16px] leading-[1.5] text-black placeholder:text-[rgba(0,0,0,0.6)] bg-transparent border-none outline-none"
            />
          </div>
        ) : (
          <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid rounded-[12px] min-h-[299px] px-[12px] py-[8px] w-full">
            <div className="prose prose-sm dark:prose-invert max-w-none font-['Inter'] text-[16px] leading-[1.5] text-black">
              <ReactMarkdown
                rehypePlugins={markdownRehypePlugins}
                components={customMarkdownComponents}
              >
                {event.paywall_content || ""}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="font-['Inter'] font-normal text-[16px] leading-[1.5] text-[#7f7f7f] w-full">
        *This content is visible only to participants who have joined/paid for the event.
      </p>
    </div>
  );
}
