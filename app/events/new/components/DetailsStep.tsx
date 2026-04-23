"use client";

import { useState } from "react";
import { Pencil, Eye } from "lucide-react";
import type { WizardStepProps } from "@/lib/types/wizard";
import { BasicInfoEditor } from "./editors/BasicInfoEditor";
import { ContentEditor } from "./editors/ContentEditor";
import { ScheduleEditor } from "./editors/ScheduleEditor";
import { FAQEditor } from "./editors/FAQEditor";
import { RulesEditor } from "./editors/RulesEditor";
import { ResourcesEditor } from "./editors/ResourcesEditor";

type EditSection =
  | "basic-info"
  | "overview"
  | "schedule"
  | "faqs"
  | "rules"
  | "resources";

const EDIT_SECTIONS: { value: EditSection; label: string }[] = [
  { value: "basic-info", label: "Basic Info" },
  { value: "overview", label: "Overview" },
  { value: "schedule", label: "Schedule" },
  { value: "faqs", label: "FAQs" },
  { value: "rules", label: "Rules" },
  { value: "resources", label: "Resources" },
];

export function DetailsStep({ event, setEvent }: WizardStepProps) {
  const [stepMode, setStepMode] = useState<"edit" | "preview">("edit");
  const [editSection, setEditSection] = useState<EditSection>("basic-info");

  const update = (fields: Partial<typeof event>) =>
    setEvent((prev) => ({ ...prev, ...fields }));

  return (
    <div className="space-y-6 w-full">
      {/* Top bar: Edit/Preview toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setStepMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              stepMode === "edit"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setStepMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              stepMode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Section chips (edit mode only) */}
      {stepMode === "edit" && (
        <div className="flex flex-wrap gap-2">
          {EDIT_SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setEditSection(s.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                editSection === s.value
                  ? "bg-[#4B89EF] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {stepMode === "preview" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <PreviewSummary event={event} />
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-6">
          {editSection === "basic-info" && (
            <BasicInfoEditor event={event} update={update} />
          )}
          {editSection === "overview" && (
            <ContentEditor event={event} update={update} />
          )}
          {editSection === "schedule" && (
            <ScheduleEditor event={event} update={update} />
          )}
          {editSection === "faqs" && (
            <FAQEditor event={event} update={update} />
          )}
          {editSection === "rules" && (
            <RulesEditor event={event} update={update} />
          )}
          {editSection === "resources" && (
            <ResourcesEditor event={event} update={update} />
          )}
        </div>
      )}
    </div>
  );
}

/** Simple read-only preview of all event details */
function PreviewSummary({ event }: { event: WizardStepProps["event"] }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      {event.cover_image_url && (
        <img
          src={event.cover_image_url}
          alt="Cover"
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {event.event_name || "Untitled Event"}
        </h1>
        {event.event_blurb && (
          <p className="mt-1 text-gray-500">{event.event_blurb}</p>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        {event.event_date && <span>Date: {event.event_date}</span>}
        {event.location && <span>Location: {event.location}</span>}
        {event.participant_capacity && (
          <span>Capacity: {event.participant_capacity}</span>
        )}
      </div>

      {/* Description */}
      {event.event_description && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {event.event_description}
          </p>
        </div>
      )}

      {/* Schedule */}
      {event.schedule.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Schedule</h3>
          {event.schedule.map((day, i) => (
            <div key={i} className="mb-3">
              <p className="font-medium text-gray-800">{day.date}</p>
              <ul className="ml-4 mt-1 space-y-1">
                {day.events.map((ev, j) => (
                  <li key={j} className="text-sm text-gray-600">
                    {ev.time && (
                      <span className="font-medium">{ev.time} — </span>
                    )}
                    {ev.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* FAQs */}
      {event.faqs.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">FAQs</h3>
          <div className="space-y-3">
            {event.faqs.map((faq, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-gray-800">
                  {faq.question}
                </p>
                <p className="text-sm text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {event.rules.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Rules</h3>
          {event.rules.map((section, i) => (
            <div key={i} className="mb-2">
              <p className="text-sm font-medium text-gray-800">
                {section.title}
              </p>
              <ul className="ml-4 list-disc text-sm text-gray-600">
                {section.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Resources */}
      {event.resources.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Resources</h3>
          <ul className="space-y-1">
            {event.resources.map((r, i) => (
              <li key={i} className="text-sm">
                <span className="text-gray-800">{r.name}</span>
                {" — "}
                <span className="text-blue-600">{r.link}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
