"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Building2,
  Video,
  ImageIcon,
  Calendar,
  Users,
} from "lucide-react";
import type { WizardEventData } from "@/lib/types/wizard";
import { slugify } from "@/lib/types/wizard";
import { Switch } from "@/components/ui/switch";

const PRESET_EVENT_TYPES = ["Hackathon", "Workshop", "Conference"] as const;

interface BasicInfoEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

export function BasicInfoEditor({ event, update }: BasicInfoEditorProps) {
  const [customEventType, setCustomEventType] = useState("");
  const [baseUrl, setBaseUrl] = useState(process.env.NEXT_PUBLIC_BASE_URL || "");

  useEffect(() => {
    if (!baseUrl && typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, [baseUrl]);

  return (
    <>
      {/* Event Name + Blurb */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <input
          type="text"
          value={event.event_name}
          onChange={(e) => {
            const name = e.target.value;
            update({
              event_name: name,
              slug: event.slug === slugify(event.event_name) ? slugify(name) : event.slug,
            });
          }}
          placeholder="Event Title"
          className="w-full border-none bg-transparent font-geist text-3xl font-semibold tracking-[-0.06em] text-gray-900 outline-none placeholder:text-gray-300"
        />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Blurb</label>
          <input
            type="text"
            value={event.event_blurb}
            onChange={(e) => update({ event_blurb: e.target.value })}
            placeholder="Short description shown in the preview card"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
          <p className="text-xs text-gray-400">
            A short tagline that appears in the event card and header.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            External link <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={event.external_url}
            onChange={(e) => update({ external_url: e.target.value })}
            placeholder="https://example.com/your-event"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
          <p className="text-xs text-gray-400">
            Leave blank for a normal event.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                Redirect visitors to external link
              </p>
              <p className="text-xs text-gray-500">
                Turn off to keep the MentorMates event page open while storing
                the external URL.
              </p>
            </div>
            <Switch
              checked={event.external_redirect_enabled === true}
              disabled={!event.external_url.trim()}
              onCheckedChange={(checked) =>
                update({ external_redirect_enabled: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Core Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 font-geist text-lg font-semibold tracking-[-0.06em] text-gray-900">
          Basic Information
        </h2>

        <div className="space-y-5">
          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              URL Slug
            </label>
            <input
              type="text"
              value={event.slug}
              onChange={(e) =>
                update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
              }
              placeholder="auto-generated-from-name"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
            />
            <p className="text-xs text-gray-400">
              {baseUrl}/events/{event.slug || "your-event-slug"}
            </p>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={event.event_date}
                onChange={(e) => update({ event_date: e.target.value })}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>

          {/* Submission Window */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Submission Window
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Opens</label>
                <input
                  type="datetime-local"
                  value={event.submission_time_start}
                  onChange={(e) =>
                    update({ submission_time_start: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Closes</label>
                <input
                  type="datetime-local"
                  value={event.submission_time_cutoff}
                  onChange={(e) =>
                    update({ submission_time_cutoff: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                />
              </div>
            </div>
          </div>

          {/* Participant Cap */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Participant Cap
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={
                  event.participant_capacity !== null
                    ? String(event.participant_capacity)
                    : ""
                }
                onChange={(e) =>
                  update({
                    participant_capacity:
                      e.target.value === ""
                        ? null
                        : Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                placeholder="Leave blank for unlimited"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Location
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (
                    !event.location ||
                    event.location.toLowerCase() === "online"
                  ) {
                    update({ location: "", location_type: "in-person" });
                  } else {
                    update({ location_type: "in-person" });
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  event.location_type === "in-person"
                    ? "bg-[#4B89EF] text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Building2 className="size-5" />
                In-person
              </button>
              <button
                type="button"
                onClick={() =>
                  update({ location_type: "virtual", location: "Online" })
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  event.location_type === "virtual"
                    ? "bg-[#4B89EF] text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Video className="size-5" />
                Virtual
              </button>
            </div>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={event.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder={
                  event.location_type === "in-person"
                    ? "Enter venue address"
                    : "Online"
                }
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>

          {/* Cover Image */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Cover Image URL
            </label>
            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={event.cover_image_url}
                onChange={(e) => update({ cover_image_url: e.target.value })}
                placeholder="https://..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>

          {/* Event Type (tags) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Event Type
            </label>
            {/* Selected tags */}
            <div className="flex flex-wrap gap-2">
              {(event.event_type || []).map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-800"
                >
                  {type}
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        event_type: (event.event_type || []).filter(
                          (t) => t !== type
                        ),
                      })
                    }
                    className="ml-1 text-blue-400 hover:text-blue-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2">
              {PRESET_EVENT_TYPES.filter(
                (opt) => !(event.event_type || []).includes(opt)
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    update({
                      event_type: [...(event.event_type || []), opt],
                    })
                  }
                  className="px-3 py-1 border border-dashed border-gray-300 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + {opt}
                </button>
              ))}
            </div>
            {/* Custom type input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customEventType}
                onChange={(e) => setCustomEventType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customEventType.trim()) {
                    e.preventDefault();
                    if (
                      !(event.event_type || []).includes(
                        customEventType.trim()
                      )
                    ) {
                      update({
                        event_type: [
                          ...(event.event_type || []),
                          customEventType.trim(),
                        ],
                      });
                    }
                    setCustomEventType("");
                  }
                }}
                placeholder="Add custom type (e.g., Demo Day)"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
              <button
                type="button"
                disabled={!customEventType.trim()}
                onClick={() => {
                  if (
                    customEventType.trim() &&
                    !(event.event_type || []).includes(customEventType.trim())
                  ) {
                    update({
                      event_type: [
                        ...(event.event_type || []),
                        customEventType.trim(),
                      ],
                    });
                    setCustomEventType("");
                  }
                }}
                className="px-4 h-11 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


