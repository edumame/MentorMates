"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import {
  buildLegacyProjectPayloadFromValues,
  buildNullLegacyProjectPayload,
  buildSubmissionAnswersPayload,
  type EffectiveSubmissionField,
  type SubmissionValue,
} from "@/features/projects/utils/effectiveSubmission";

interface UseProjectSubmissionAutosaveOptions {
  enabled: boolean;
  projectId: string | null;
  fields: EffectiveSubmissionField[];
  values: Record<string, SubmissionValue>;
  hasConfiguredSubmissionFields: boolean;
  initializeAsSaved?: boolean;
  extraPayload?: Record<string, unknown>;
  artifacts?: Array<{
    kind: "project_link" | "video_link" | "additional_material";
    label: string;
    url: string;
    sort_order: number;
    is_primary: boolean;
  }>;
  onSaved?: (project: Project | null) => void;
}

export function useProjectSubmissionAutosave({
  enabled,
  projectId,
  fields,
  values,
  hasConfiguredSubmissionFields,
  initializeAsSaved = false,
  extraPayload,
  artifacts,
  onSaved,
}: UseProjectSubmissionAutosaveOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const initializedProjectIdRef = useRef<string | null>(null);

  const payload = useMemo(() => {
    const basePayload = hasConfiguredSubmissionFields
      ? {
          ...buildNullLegacyProjectPayload(),
          submission_answers: buildSubmissionAnswersPayload(fields, values),
        }
      : {
          ...buildLegacyProjectPayloadFromValues(values),
          ...(artifacts ? { artifacts } : {}),
        };

    return {
      ...basePayload,
      ...extraPayload,
    };
  }, [
    artifacts,
    extraPayload,
    fields,
    hasConfiguredSubmissionFields,
    values,
  ]);

  const payloadSnapshot = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    if (
      initializeAsSaved &&
      projectId &&
      initializedProjectIdRef.current !== projectId
    ) {
      lastSavedSnapshotRef.current = payloadSnapshot;
      initializedProjectIdRef.current = projectId;
      return;
    }

    if (!enabled || !projectId || payloadSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    const timer = window.setTimeout(async () => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payloadSnapshot,
        });

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as { project?: Project };
        lastSavedSnapshotRef.current = payloadSnapshot;
        setLastSaved(new Date());
        onSaved?.(json.project || null);
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [enabled, initializeAsSaved, onSaved, payloadSnapshot, projectId, isSaving]);

  return {
    isSaving,
    lastSaved,
    setLastSavedSnapshot: (snapshot: string) => {
      lastSavedSnapshotRef.current = snapshot;
    },
  };
}
