"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventDetails } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="paywall_content">Exclusive Content for Participants</Label>

          {/* Edit/Preview Toggle */}
          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-[4px] flex items-start">
            <button
              type="button"
              onClick={() => setActiveMode("edit")}
              className={`px-[24px] py-[6px] rounded-[8px] text-[12px] font-medium transition-colors ${
                activeMode === "edit"
                  ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] text-black"
                  : "bg-transparent border border-transparent text-black"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("preview")}
              className={`px-[16px] py-[6px] rounded-[100px] text-[12px] transition-colors ${
                activeMode === "preview"
                  ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] text-black font-medium"
                  : "bg-transparent border border-transparent text-black font-normal"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {activeMode === "edit" ? (
          <Textarea
            id="paywall_content"
            value={event.paywall_content || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, paywall_content: e.target.value })
            }
            rows={12}
            placeholder="Add content (markdown supported)"
            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-[12px] py-[8px] text-[16px] font-normal leading-[1.5] text-black placeholder:text-[rgba(0,0,0,0.6)]"
          />
        ) : (
          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-[12px] py-[8px] min-h-[299px]">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                rehypePlugins={markdownRehypePlugins}
                components={customMarkdownComponents}
              >
                {event.paywall_content || ""}
              </ReactMarkdown>
            </div>
          </div>
        )}

        <p className="text-[16px] font-normal leading-[1.5] text-[#7f7f7f]">
          *This content is visible only to participants who have joined/paid for the event.
        </p>
      </div>
    </div>
  );
}
