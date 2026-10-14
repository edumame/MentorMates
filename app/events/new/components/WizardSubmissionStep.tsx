"use client";

import { Users, Shuffle } from "lucide-react";
import type { WizardStepProps } from "@/lib/types/wizard";
import {
  SubmissionStep,
  type SubmissionField,
} from "@/components/events/submission";

/**
 * Wizard Step 2 — Submission Form
 *
 * Bridges WizardEventData to the existing SubmissionStep component,
 * and adds team settings (max_team_size, allow_multiple_tracks) below.
 */
export function WizardSubmissionStep({ event, setEvent }: WizardStepProps) {
  // The existing SubmissionStep takes { fields, onChange } — bridge from wizard state
  const handleFieldsChange = (fields: SubmissionField[]) => {
    setEvent((prev) => ({
      ...prev,
      submission_fields: fields,
    }));
  };

  return (
    <div className="space-y-8">
      {/* Existing submission field editor (edit/preview toggle built in) */}
      <SubmissionStep
        fields={event.submission_fields as SubmissionField[]}
        onChange={handleFieldsChange}
      />

      {/* Team Settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 font-geist text-lg font-semibold tracking-[-0.06em] text-gray-900">
          Team Settings
        </h2>
        <div className="space-y-5">
          {/* Max team size */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Maximum Team Size
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min={1}
                value={
                  event.max_team_size !== null
                    ? String(event.max_team_size)
                    : ""
                }
                onChange={(e) =>
                  setEvent((prev) => ({
                    ...prev,
                    max_team_size:
                      e.target.value === ""
                        ? null
                        : Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                placeholder="Leave blank for no limit"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
            <p className="text-xs text-gray-400">
              Maximum number of members per team. Leave blank for unlimited.
            </p>
          </div>

          {/* Allow multiple tracks */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Shuffle className="size-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Allow Multiple Tracks
                </p>
                <p className="text-xs text-gray-500">
                  Teams can submit to more than one track
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={event.allow_multiple_tracks}
              onClick={() =>
                setEvent((prev) => ({
                  ...prev,
                  allow_multiple_tracks: !prev.allow_multiple_tracks,
                }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                event.allow_multiple_tracks ? "bg-[#4B89EF]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  event.allow_multiple_tracks
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
