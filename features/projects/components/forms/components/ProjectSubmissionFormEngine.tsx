"use client";

import type { ChangeEvent, ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
import { EventCard } from "@/components/events/event-card";
import { EventDetails, EventSubmissionField } from "@/lib/types";
import { TextFields } from "@mui/icons-material";
import {
  Calendar,
  CalendarClock,
  ExternalLink,
  Github,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  ThumbsUp,
  Youtube,
} from "lucide-react";

type SubmissionAnswerValue = string | string[];
const BUILT_IN_FIELD_KEYS = new Set([
  "project_name",
  "project_description",
  "project_url",
  "video_url",
  "cover_image",
  "additional_materials",
]);

export interface ProjectSubmissionFormValues {
  projectName: string;
  projectDescription: string;
  teammates: string[];
  projectUrl: string;
  videoUrl: string;
  coverImageUrl: string;
  additionalMaterialsUrl: string;
}

export interface ProjectSubmissionTrackOption {
  id: string;
  name: string;
  description?: string;
}

interface ProjectSubmissionFormEngineProps {
  title: string;
  description?: string;
  toolbarLeading?: ReactNode;
  actions?: ReactNode;
  formData: ProjectSubmissionFormValues;
  onFormDataChange: (updates: Partial<ProjectSubmissionFormValues>) => void;
  eventSelectionSection?: ReactNode;
  tracks: ProjectSubmissionTrackOption[];
  selectedTrackIds: string[];
  isLoadingTracks?: boolean;
  onTrackToggle: (trackId: string, checked: boolean) => void;
  tracksLabel?: string;
  tracksHelpText?: string;
  showDescriptionPreview: boolean;
  onToggleDescriptionPreview: () => void;
  onCoverImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAdditionalMaterialsUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAdditionalMaterialsExtraUpload: (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  extraProjectUrls: string[];
  onExtraProjectUrlChange: (index: number, value: string) => void;
  onAddProjectUrl: () => void;
  onRemoveProjectUrl: (index: number) => void;
  extraVideoUrls: string[];
  onExtraVideoUrlChange: (index: number, value: string) => void;
  onAddVideoUrl: () => void;
  onRemoveVideoUrl: (index: number) => void;
  extraMaterialsUrls: string[];
  onExtraMaterialsUrlChange: (index: number, value: string) => void;
  onAddMaterialsUrl: () => void;
  onRemoveMaterialsUrl: (index: number) => void;
  submissionFields: EventSubmissionField[];
  submissionAnswers: Record<string, SubmissionAnswerValue>;
  onSubmissionAnswerChange: (
    fieldId: string,
    value: SubmissionAnswerValue,
  ) => void;
  teammateTagOptions: string[];
  teammateInitialTags: string[];
  onTeammatesChange: (tags: string[]) => void | Promise<void>;
  projectId?: string;
  teammateList?: ReactNode;
  previewStatusBadge: ReactNode;
  previewRoleBadge?: ReactNode;
  previewDateText: string;
  previewProjectNameFallback?: string;
  previewDescriptionFallback?: string;
  previewCoverFallbackClassName?: string;
  totalMembers: number;
  onPreviewClick: () => void;
  previewEnabled: boolean;
  previewDisabledTitle: string;
  eventDetails?: EventDetails | null;
  eventHref?: string;
  showCalendarClock?: boolean;
  readOnly?: boolean;
  hideSidePreview?: boolean;
  teammateReadOnlyContent?: ReactNode;
}

export function ProjectSubmissionFormEngine({
  title,
  description,
  toolbarLeading,
  actions,
  formData,
  onFormDataChange,
  eventSelectionSection,
  tracks,
  selectedTrackIds,
  isLoadingTracks = false,
  onTrackToggle,
  tracksLabel = "Select tracks",
  tracksHelpText = "Choose the tracks your project should compete in.",
  showDescriptionPreview,
  onToggleDescriptionPreview,
  onCoverImageUpload,
  onAdditionalMaterialsUpload,
  onAdditionalMaterialsExtraUpload,
  extraProjectUrls,
  onExtraProjectUrlChange,
  onAddProjectUrl,
  onRemoveProjectUrl,
  extraVideoUrls,
  onExtraVideoUrlChange,
  onAddVideoUrl,
  onRemoveVideoUrl,
  extraMaterialsUrls,
  onExtraMaterialsUrlChange,
  onAddMaterialsUrl,
  onRemoveMaterialsUrl,
  submissionFields,
  submissionAnswers,
  onSubmissionAnswerChange,
  teammateTagOptions,
  teammateInitialTags,
  onTeammatesChange,
  projectId,
  teammateList,
  previewStatusBadge,
  previewRoleBadge,
  previewDateText,
  previewProjectNameFallback = "Relief Map",
  previewDescriptionFallback = "Join the community and enter weekly raffles for free conference tickets and VIP upgrades, plus free credits for top AI and SaaS tools.",
  previewCoverFallbackClassName = "bg-gradient-to-br from-gray-200 to-gray-300",
  totalMembers,
  onPreviewClick,
  previewEnabled,
  previewDisabledTitle,
  eventDetails,
  eventHref,
  showCalendarClock = false,
  readOnly = false,
  hideSidePreview = false,
  teammateReadOnlyContent,
}: ProjectSubmissionFormEngineProps) {
  const getAnswerText = (fieldId: string) =>
    typeof submissionAnswers[fieldId] === "string"
      ? (submissionAnswers[fieldId] as string)
      : "";

  const getAnswerUrls = (fieldId: string) =>
    Array.isArray(submissionAnswers[fieldId])
      ? (submissionAnswers[fieldId] as string[])
      : [""];

  const CalendarIcon = showCalendarClock ? CalendarClock : Calendar;
  const hasSchemaFields = submissionFields.length > 0;
  const fieldByKey = new Map(
    submissionFields.map((field) => [field.key, field]),
  );
  const hasField = (key: string) => !hasSchemaFields || fieldByKey.has(key);
  const getField = (key: string) => fieldByKey.get(key);
  const customFields = hasSchemaFields
    ? submissionFields.filter((field) => !BUILT_IN_FIELD_KEYS.has(field.key))
    : [];

  return (
    <div className="mx-auto px-8 py-6 min-h-[800px]">
      {(toolbarLeading || actions) && (
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>{toolbarLeading}</div>
          <div className="flex items-center gap-1 justify-end">{actions}</div>
        </div>
      )}

      <div className="flex justify-between gap-[50px] sm:gap-[85px] flex-wrap-reverse sm:flex-nowrap">
        <div className="flex-1 space-y-6">
          <div className="space-y-1">
            <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
              {title}
            </h1>
            {description ? (
              <p className="text-base text-black">{description}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            {hasField("project_name") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("project_name")?.label || "Project name"}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  <TextFields className="h-6 w-6 shrink-0" />
                  <Input
                    value={formData.projectName}
                    onChange={(e) =>
                      onFormDataChange({ projectName: e.target.value })
                    }
                    readOnly={readOnly}
                    placeholder={
                      getField("project_name")?.placeholder ||
                      "Short description shown in the preview card"
                    }
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                  />
                </div>
                {getField("project_name")?.description ? (
                  <p className="text-base text-[#7f7f7f]">
                    {getField("project_name")?.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            {eventSelectionSection}

            {hasField("project_description") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("project_description")?.label ||
                    "Project Description"}
                </label>
                <Textarea
                  value={formData.projectDescription}
                  onChange={(e) =>
                    onFormDataChange({ projectDescription: e.target.value })
                  }
                  readOnly={readOnly}
                  placeholder={
                    getField("project_description")?.placeholder ||
                    "Long description or markdown"
                  }
                  rows={7}
                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none"
                />
                <p className="text-base text-[#7f7f7f]">
                  {getField("project_description")?.description ||
                    "Markdown supported: use headings, lists, links, and emphasis."}
                </p>
                {formData.projectDescription.trim() ? (
                  <>
                    <button
                      type="button"
                      onClick={onToggleDescriptionPreview}
                      disabled={readOnly}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {showDescriptionPreview ? "Hide preview" : "Show preview"}
                    </button>
                    {showDescriptionPreview ? (
                      <div className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white px-3 py-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Preview
                        </p>
                        <ProjectDescription
                          value={formData.projectDescription}
                          className="text-base"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-dashed border-gray-200" />

            {tracks.length > 0 && (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {tracksLabel}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl p-4 space-y-3">
                  {isLoadingTracks ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    tracks.map((track) => (
                      <label
                        key={track.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTrackIds.includes(track.id)}
                          onChange={(e) =>
                            onTrackToggle(track.id, e.target.checked)
                          }
                          disabled={readOnly}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-base text-black font-medium">
                            {track.name}
                          </span>
                          {track.description ? (
                            <p className="text-sm text-[#7f7f7f] mt-0.5">
                              {track.description}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-base text-[#7f7f7f]">{tracksHelpText}</p>
              </div>
            )}

            {hasField("cover_image") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("cover_image")?.label || "Cover image url"}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  <ImageIcon className="h-6 w-6 shrink-0" />
                  <Input
                    value={formData.coverImageUrl}
                    onChange={(e) =>
                      onFormDataChange({ coverImageUrl: e.target.value })
                    }
                    readOnly={readOnly}
                    placeholder={
                      getField("cover_image")?.placeholder || "https://..."
                    }
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                  />
                  {!readOnly ? (
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onCoverImageUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-black font-normal">
                        Upload
                      </span>
                    </label>
                  ) : null}
                </div>
                <p className="text-base text-[#7f7f7f]">
                  {getField("cover_image")?.description ||
                    "Upload an image to showcase your project (Max 10MB)."}
                </p>
              </div>
            ) : null}

            {hasField("additional_materials") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("additional_materials")?.label ||
                    "Additional materials"}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  <Paperclip className="h-6 w-6 shrink-0" />
                  <Input
                    value={formData.additionalMaterialsUrl}
                    onChange={(e) =>
                      onFormDataChange({
                        additionalMaterialsUrl: e.target.value,
                      })
                    }
                    readOnly={readOnly}
                    placeholder={
                      getField("additional_materials")?.placeholder ||
                      "https://..."
                    }
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                  />
                  {!readOnly ? (
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input
                        type="file"
                        onChange={onAdditionalMaterialsUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-black font-normal">
                        Upload
                      </span>
                    </label>
                  ) : null}
                </div>
                {extraMaterialsUrls.map((url, index) => (
                  <div key={`materials-extra-${index}`} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) =>
                        onExtraMaterialsUrlChange(index, e.target.value)
                      }
                      readOnly={readOnly}
                      placeholder="https://..."
                      className="h-11"
                    />
                    {!readOnly ? (
                      <>
                        <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0 h-11 inline-flex items-center">
                          <input
                            type="file"
                            onChange={(e) =>
                              onAdditionalMaterialsExtraUpload(index, e)
                            }
                            className="hidden"
                          />
                          <span className="text-xs text-black font-normal">
                            Upload
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onRemoveMaterialsUrl(index)}
                        >
                          Remove
                        </Button>
                      </>
                    ) : null}
                  </div>
                ))}
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onAddMaterialsUrl}
                  >
                    Add another materials link
                  </Button>
                ) : null}
                <p className="text-base text-[#7f7f7f]">
                  {getField("additional_materials")?.description ||
                    "Upload any additional documentation (Max 10MB)."}
                </p>
              </div>
            ) : null}

            {hasField("project_url") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("project_url")?.label ||
                    "GitHub or live link (Optional)"}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  <Github className="h-6 w-6 shrink-0" />
                  <Input
                    value={formData.projectUrl}
                    onChange={(e) =>
                      onFormDataChange({ projectUrl: e.target.value })
                    }
                    readOnly={readOnly}
                    placeholder={
                      getField("project_url")?.placeholder || "https://..."
                    }
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                  />
                </div>
                {extraProjectUrls.map((url, index) => (
                  <div
                    key={`project-link-extra-${index}`}
                    className="flex gap-2"
                  >
                    <Input
                      value={url}
                      onChange={(e) =>
                        onExtraProjectUrlChange(index, e.target.value)
                      }
                      readOnly={readOnly}
                      placeholder="https://..."
                      className="h-11"
                    />
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onRemoveProjectUrl(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onAddProjectUrl}
                  >
                    Add another project link
                  </Button>
                ) : null}
                {getField("project_url")?.description ? (
                  <p className="text-base text-[#7f7f7f]">
                    {getField("project_url")?.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasField("video_url") ? (
              <div className="space-y-2">
                <label className="text-base text-black font-normal">
                  {getField("video_url")?.label || "Video link (Optional)"}
                </label>
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  <Youtube className="h-6 w-6 shrink-0" />
                  <Input
                    value={formData.videoUrl}
                    onChange={(e) =>
                      onFormDataChange({ videoUrl: e.target.value })
                    }
                    readOnly={readOnly}
                    placeholder={
                      getField("video_url")?.placeholder || "https://..."
                    }
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                  />
                </div>
                {extraVideoUrls.map((url, index) => (
                  <div key={`video-link-extra-${index}`} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) =>
                        onExtraVideoUrlChange(index, e.target.value)
                      }
                      readOnly={readOnly}
                      placeholder="https://..."
                      className="h-11"
                    />
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onRemoveVideoUrl(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onAddVideoUrl}
                  >
                    Add another video link
                  </Button>
                ) : null}
                {getField("video_url")?.description ? (
                  <p className="text-base text-[#7f7f7f]">
                    {getField("video_url")?.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            {customFields.length > 0 && (
              <div className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-medium text-black">
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    {field.description ? (
                      <p className="text-xs text-[#7f7f7f]">
                        {field.description}
                      </p>
                    ) : null}
                    {field.field_type === "long_text" ? (
                      <Textarea
                        value={getAnswerText(field.id)}
                        onChange={(e) =>
                          onSubmissionAnswerChange(field.id, e.target.value)
                        }
                        readOnly={readOnly}
                        placeholder={field.placeholder || ""}
                        rows={4}
                      />
                    ) : field.field_type === "multi_url" ? (
                      <div className="space-y-2">
                        {getAnswerUrls(field.id).map((url, index) => (
                          <div
                            key={`${field.id}-${index}`}
                            className="flex gap-2"
                          >
                            <Input
                              value={url}
                              onChange={(e) => {
                                const urls = [...getAnswerUrls(field.id)];
                                urls[index] = e.target.value;
                                onSubmissionAnswerChange(field.id, urls);
                              }}
                              readOnly={readOnly}
                              placeholder={field.placeholder || "https://..."}
                            />
                            {!readOnly ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const urls = getAnswerUrls(field.id).filter(
                                    (_, urlIndex) => urlIndex !== index,
                                  );
                                  onSubmissionAnswerChange(
                                    field.id,
                                    urls.length > 0 ? urls : [""],
                                  );
                                }}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        ))}
                        {!readOnly ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              onSubmissionAnswerChange(field.id, [
                                ...getAnswerUrls(field.id),
                                "",
                              ])
                            }
                          >
                            Add another link
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <Input
                        type={field.field_type === "url" ? "url" : "text"}
                        value={getAnswerText(field.id)}
                        onChange={(e) =>
                          onSubmissionAnswerChange(field.id, e.target.value)
                        }
                        readOnly={readOnly}
                        placeholder={field.placeholder || ""}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-dashed border-gray-200" />

            <div className="space-y-2">
              <label className="text-base text-black font-normal">
                Add teammates (Optional)
              </label>
              <div className="border border-gray-200 rounded-xl">
                {readOnly ? (
                  <div className="px-4 py-4 text-sm text-[#7f7f7f] border-b border-gray-200">
                    {teammateReadOnlyContent || (
                      <span>
                        Invite teammates by email during project submission.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 px-3 border-b border-gray-200">
                    <UserSearchWithInvite
                      allTags={teammateTagOptions}
                      onTagsChange={onTeammatesChange}
                      initialTags={teammateInitialTags}
                      projectId={projectId}
                      enableInvite={true}
                      enableMailIcon={true}
                      inputStyle="pure"
                      placeholder="Enter your teammates' emails. Press Enter or comma to add each."
                    />
                  </div>
                )}
                {teammateList}
              </div>
            </div>
          </div>
        </div>

        {!hideSidePreview ? (
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl overflow-hidden w-full sm:w-[339px]">
                <div className="aspect-[339/220] relative">
                  {formData.coverImageUrl ? (
                    <img
                      src={formData.coverImageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full ${previewCoverFallbackClassName}`}
                    />
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[22px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                          {formData.projectName || previewProjectNameFallback}
                        </h3>
                        {previewStatusBadge}
                        {previewRoleBadge}
                      </div>
                      <p className="text-base text-black line-clamp-2">
                        {formData.projectDescription ||
                          previewDescriptionFallback}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-5 w-5 text-[#575d65]" />
                        <span className="text-sm text-[#575d65]">
                          {previewDateText}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-5 w-5 text-[#575d65]" />
                        <span className="text-sm text-[#575d65]">36</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquarePlus className="h-5 w-5 text-[#575d65]" />
                        <span className="text-sm text-[#575d65]">2</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                      {[...Array(Math.min(totalMembers, 4))].map((_, i) => (
                        <div
                          key={i}
                          className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white"
                        />
                      ))}
                    </div>
                    <MoreHorizontal className="h-6 w-6 text-[#7f7f7f]" />
                  </div>
                </div>
              </div>

              {!readOnly ? (
                <button
                  onClick={onPreviewClick}
                  disabled={!previewEnabled}
                  title={previewDisabledTitle}
                  className="flex items-center gap-1 justify-center text-[#7f7f7f] hover:text-black transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-base">Preview project page</span>
                  <ExternalLink className="h-4.5 w-4.5" />
                </button>
              ) : null}
            </div>

            {eventDetails && eventHref ? (
              <>
                <div className="border-t border-gray-200" />
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-black tracking-tight">
                    Submitted to
                  </h3>
                  <div className="w-[339px]">
                    <Link href={eventHref}>
                      <EventCard
                        event={{
                          event_id: eventDetails.event_id,
                          slug: eventDetails.slug,
                          event_name: eventDetails.event_name,
                          event_date: eventDetails.event_date,
                          location: eventDetails.location || "Online",
                          cover_image_url: eventDetails.cover_image_url,
                          paid: eventDetails.paid,
                          event_blurb:
                            eventDetails.event_blurb ||
                            eventDetails.event_description,
                          event_description: eventDetails.event_description,
                        }}
                      />
                    </Link>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
