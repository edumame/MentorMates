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

const EVENT_TYPES = ["Hackathon", "Workshop", "Conference", "Other"] as const;

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
          className="w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-gray-900 outline-none placeholder:text-gray-300"
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
      </div>

      {/* Core Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">
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

          {/* Event Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Event Type
            </label>
            <select
              value={
                EVENT_TYPES.includes(
                  event.event_type as (typeof EVENT_TYPES)[number]
                )
                  ? event.event_type
                  : "Other"
              }
              onChange={(e) => {
                if (e.target.value === "Other") {
                  update({ event_type: customEventType });
                } else {
                  update({ event_type: e.target.value });
                  setCustomEventType("");
                }
              }}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {!EVENT_TYPES.includes(
              event.event_type as (typeof EVENT_TYPES)[number]
            ) && (
              <input
                type="text"
                value={customEventType || event.event_type}
                onChange={(e) => {
                  setCustomEventType(e.target.value);
                  update({ event_type: e.target.value });
                }}
                placeholder="Enter custom type (e.g., Demo Day)"
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
