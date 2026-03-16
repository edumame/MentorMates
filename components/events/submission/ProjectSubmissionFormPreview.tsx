"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ProjectSubmissionFormEngine } from "@/features/projects/components/forms/components/ProjectSubmissionFormEngine";
import { EventSubmissionField } from "@/lib/types";
import {
  DEFAULT_SUBMISSION_FIELDS,
  SubmissionField,
  editorTypeToDb,
} from "./types";

interface ProjectSubmissionFormPreviewProps {
  fields: SubmissionField[];
}

const BUILT_IN_FIELD_IDS = new Set(
  DEFAULT_SUBMISSION_FIELDS.map((field) => field.id),
);

export function ProjectSubmissionFormPreview({
  fields,
}: ProjectSubmissionFormPreviewProps) {
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);

  const builtInFieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );

  const customSubmissionFields = useMemo<EventSubmissionField[]>(
    () =>
      fields
        .filter((field) => !BUILT_IN_FIELD_IDS.has(field.id))
        .map((field, index) => ({
          id: field.id,
          event_id: "preview",
          key: field.id,
          label: field.label,
          description: field.helperText || null,
          placeholder: field.placeholder || null,
          field_type: editorTypeToDb(
            field.type,
          ) as EventSubmissionField["field_type"],
          required: field.required,
          sort_order: index,
          is_active: true,
          options: field.options || [],
        })),
    [fields],
  );

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white">
      <div className="border-b border-[#d8d8d8] bg-sky-50 px-6 py-3.5">
        <p className="text-base font-medium tracking-[-0.06em] text-[#4c4c4c]">
          Preview: participant submission form
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
        <ProjectSubmissionFormEngine
          title="Create your project"
          description="This preview uses the same form engine participants see when creating or editing a submission."
          formData={{
            projectName:
              builtInFieldMap.get("project_name")?.placeholder ||
              "Project Nebula",
            projectDescription:
              builtInFieldMap.get("project_description")?.placeholder ||
              "A collaborative AI workspace for building prototypes faster.",
            teammates: [],
            projectUrl:
              builtInFieldMap.get("project_url")?.placeholder || "https://...",
            videoUrl:
              builtInFieldMap.get("video_url")?.placeholder || "https://...",
            coverImageUrl:
              builtInFieldMap.get("cover_image")?.placeholder || "",
            additionalMaterialsUrl:
              builtInFieldMap.get("additional_materials")?.placeholder ||
              "https://...",
          }}
          onFormDataChange={() => {}}
          tracks={[]}
          selectedTrackIds={[]}
          onTrackToggle={() => {}}
          showDescriptionPreview={showDescriptionPreview}
          onToggleDescriptionPreview={() =>
            setShowDescriptionPreview((prev) => !prev)
          }
          onCoverImageUpload={() => {}}
          onAdditionalMaterialsUpload={() => {}}
          onAdditionalMaterialsExtraUpload={() => {}}
          extraProjectUrls={[]}
          onExtraProjectUrlChange={() => {}}
          onAddProjectUrl={() => {}}
          onRemoveProjectUrl={() => {}}
          extraVideoUrls={[]}
          onExtraVideoUrlChange={() => {}}
          onAddVideoUrl={() => {}}
          onRemoveVideoUrl={() => {}}
          extraMaterialsUrls={[]}
          onExtraMaterialsUrlChange={() => {}}
          onAddMaterialsUrl={() => {}}
          onRemoveMaterialsUrl={() => {}}
          submissionFields={customSubmissionFields}
          submissionAnswers={{}}
          onSubmissionAnswerChange={() => {}}
          teammateTagOptions={[]}
          teammateInitialTags={[]}
          onTeammatesChange={() => {}}
          teammateList={
            <div className="px-4 py-4 text-sm text-[#7f7f7f]">
              Team members appear here after the participant adds them.
            </div>
          }
          teammateReadOnlyContent="Participants can add teammates by email here."
          previewStatusBadge={
            <Badge
              variant="secondary"
              className="rounded-full border border-[rgba(0,0,0,0.15)] bg-white text-sm text-black"
            >
              Draft
            </Badge>
          }
          previewRoleBadge={
            <Badge
              variant="secondary"
              className="rounded-full border border-[rgba(0,0,0,0.15)] bg-white text-sm text-black"
            >
              Owner
            </Badge>
          }
          previewDateText="Preview"
          totalMembers={1}
          onPreviewClick={() => {}}
          previewEnabled={false}
          previewDisabledTitle="Read-only preview"
          showCalendarClock={true}
          readOnly={true}
        />
      </div>
    </div>
  );
}
