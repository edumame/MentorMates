"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { markdownRemarkPlugins } from "@/components/markdown/plugins";
import type { WizardEventData } from "@/lib/types/wizard";

interface ContentEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

export function ContentEditor({ event, update }: ContentEditorProps) {
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "preview">(
    "edit"
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-geist text-lg font-semibold tracking-[-0.06em] text-gray-900">
          Event Description
        </h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setDescriptionMode("edit")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              descriptionMode === "edit"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDescriptionMode("preview")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              descriptionMode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {descriptionMode === "edit" ? (
        <div className="space-y-1.5">
          <textarea
            value={event.event_description}
            onChange={(e) => update({ event_description: e.target.value })}
            placeholder="Full event description (markdown supported)"
            rows={16}
            className="w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
          <p className="text-xs italic text-gray-400">
            Markdown formatting is supported — use headings, lists, links, and
            emphasis.
          </p>
        </div>
      ) : (
        <div className="min-h-[400px] overflow-auto rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-900">
          {event.event_description ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={markdownRemarkPlugins}>
                {event.event_description}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="italic text-gray-400">No description added yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
