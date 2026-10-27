"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import type { EventSubmissionField } from "@/lib/types";
import { ProjectSubmissionSchemaSection } from "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection";
import {
  buildLegacyProjectPayloadFromValues,
  buildSubmissionAnswersPayload,
  findMissingRequiredSubmissionField,
  normalizeSubmissionValue,
  sortActiveSubmissionFields,
  type SubmissionValue,
} from "@/features/projects/utils/effectiveSubmission";
import { isMultiValueSubmissionFieldType } from "@/features/projects/utils/submission";
import { uploadProjectMaterialFile } from "@/features/projects/utils/uploadProjectMaterial";

interface SubmitForParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  participantUserId: string;
  participantDisplayName: string;
  onSubmitted?: () => void;
}

type FieldsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; fields: EventSubmissionField[] };

export function SubmitForParticipantDialog({
  open,
  onOpenChange,
  eventId,
  participantUserId,
  participantDisplayName,
  onSubmitted,
}: SubmitForParticipantDialogProps) {
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, SubmissionValue>>({});
  const [fieldsState, setFieldsState] = useState<FieldsState>({ status: "loading" });
  const [fieldsReloadKey, setFieldsReloadKey] = useState(0);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitImmediately, setSubmitImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load the event's configured submission form so on-behalf submissions
  // collect the same answers participants are asked for.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFieldsState({ status: "loading" });
    (async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/submission-fields`);
        if (!response.ok) throw new Error("Failed to load submission fields");
        const json = (await response.json()) as { fields?: EventSubmissionField[] };
        if (!cancelled) {
          setFieldsState({
            status: "ready",
            fields: sortActiveSubmissionFields(json.fields || []),
          });
        }
      } catch {
        if (!cancelled) setFieldsState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId, fieldsReloadKey]);

  const configuredFields = useMemo(
    () => (fieldsState.status === "ready" ? fieldsState.fields : []),
    [fieldsState],
  );
  const usesConfiguredFields = configuredFields.length > 0;

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectUrl("");
    setVideoUrl("");
    setFieldValues({});
    setShowDescriptionPreview(false);
    setSubmitImmediately(true);
  };

  const handleClose = (next: boolean) => {
    if (!next && !isSubmitting) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleFieldChange = (key: string, value: SubmissionValue) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFieldFileUpload = async (key: string, files: File[]) => {
    const field = configuredFields.find((item) => item.key === key);
    if (!field) return;
    const uploadedUrls: string[] = [];
    for (const file of key === "cover_image" ? files.slice(0, 1) : files) {
      uploadedUrls.push(
        await uploadProjectMaterialFile(
          file,
          key === "cover_image" ? "project-covers" : "project-materials",
        ),
      );
    }
    if (uploadedUrls.length === 0) return;
    if (isMultiValueSubmissionFieldType(field.field_type)) {
      setFieldValues((prev) => ({
        ...prev,
        [key]: [
          ...normalizeSubmissionValue(field, prev[key]),
          ...uploadedUrls,
        ],
      }));
      return;
    }
    handleFieldChange(key, uploadedUrls[0]);
  };

  const buildProjectPayload = () => {
    if (usesConfiguredFields) {
      const legacy = buildLegacyProjectPayloadFromValues(fieldValues);
      return {
        project_name: legacy.project_name ?? "",
        project_description: legacy.project_description ?? undefined,
        submission_answers: buildSubmissionAnswersPayload(
          configuredFields,
          fieldValues,
        ),
      };
    }
    return {
      project_name: projectName.trim(),
      project_description: projectDescription.trim() || undefined,
      project_url: projectUrl.trim() || undefined,
      video_url: videoUrl.trim() || undefined,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fieldsState.status !== "ready" || isUploading) return;

    const project = buildProjectPayload();
    if (!project.project_name) {
      toast({ title: "Project name required", variant: "destructive" });
      return;
    }

    // Same publish-time rule as the participant submission forms; drafts may
    // be incomplete.
    if (submitImmediately && usesConfiguredFields) {
      const missingField = findMissingRequiredSubmissionField(
        configuredFields,
        fieldValues,
      );
      if (missingField) {
        toast({
          title: "Missing Information",
          description: `"${missingField.label}" is required`,
          variant: "destructive",
        });
        return;
      }
    }
    if (!project.project_description) {
      toast({ title: "Project description required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        participant_user_id: participantUserId,
        project,
        submit_immediately: submitImmediately,
      };

      const response = await fetch(
        `/api/events/${eventId}/projects/submit-for-participant`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit project");
      }

      toast({
        title: submitImmediately ? "Project submitted" : "Draft saved",
        description: `Created ${project.project_name} for ${participantDisplayName}${
          data.submitted_after_deadline ? " after the submission deadline" : ""
        }.`,
      });
      resetForm();
      onSubmitted?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    fieldsState.status === "ready" &&
    !isSubmitting &&
    !isUploading &&
    (usesConfiguredFields || projectName.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit project for {participantDisplayName}</DialogTitle>
          <DialogDescription>
            The participant will be assigned as the project lead. They can edit
            it afterwards from their profile. Organizers can submit after the
            event&apos;s submission deadline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldsState.status === "loading" ? (
            <p role="status" className="text-sm text-[#575d65]">
              Loading submission form...
            </p>
          ) : fieldsState.status === "error" ? (
            <div role="alert" className="space-y-2 text-sm text-[#575d65]">
              <p>Couldn&apos;t load this event&apos;s submission form.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFieldsReloadKey((key) => key + 1)}
              >
                Retry
              </Button>
            </div>
          ) : usesConfiguredFields ? (
            <fieldset disabled={isSubmitting} className="min-w-0">
              <ProjectSubmissionSchemaSection
                fields={configuredFields}
                values={fieldValues}
                onValueChange={handleFieldChange}
                onFileUpload={handleFieldFileUpload}
                onUploadStateChange={setIsUploading}
                showDescriptionPreview={showDescriptionPreview}
                onToggleDescriptionPreview={() =>
                  setShowDescriptionPreview((prev) => !prev)
                }
              />
            </fieldset>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name *</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. AI Tutor"
                  maxLength={200}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description *</Label>
                <Textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="One or two sentences on what it does"
                  maxLength={5000}
                  rows={3}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-url">Project URL</Label>
                <Input
                  id="project-url"
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL</Label>
                <Input
                  id="video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-[#575d65]">
            <input
              type="checkbox"
              checked={submitImmediately}
              onChange={(e) => setSubmitImmediately(e.target.checked)}
              disabled={isSubmitting}
            />
            Mark as submitted immediately (otherwise saves as draft)
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Submitting..." : submitImmediately ? "Submit" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
