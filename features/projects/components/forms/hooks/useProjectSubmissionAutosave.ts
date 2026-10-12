"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/hooks/use-toast";
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
  onError?: (error: {
    code?: string;
    message: string;
    status: number;
  }) => void;
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
  onError,
}: UseProjectSubmissionAutosaveOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const initializedProjectIdRef = useRef<string | null>(null);
  const blockedSnapshotRef = useRef<string | null>(null);

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

  const activeSave = useRef<Promise<boolean> | null>(null);
  const latest = useRef({ enabled, projectId, payloadSnapshot, onSaved, onError });
  latest.current = { enabled, projectId, payloadSnapshot, onSaved, onError };

  // Serialize manual saves with autosave; an older request must never finish
  // after the save used by publish/exit and overwrite its attachment URLs.
  const flushSave = useCallback(async (): Promise<boolean> => {
    while (activeSave.current) {
      await activeSave.current;
    }
    const current = latest.current;
    if (!current.enabled || !current.projectId) {
      toast({ title: "Unable to save draft", description: "Please wait for the project to finish loading and try again.", variant: "destructive" });
      return false;
    }
    if (current.payloadSnapshot === lastSavedSnapshotRef.current) return true;
    setIsSaving(true);
    const request = (async () => {
      try {
        const response = await fetch(`/api/projects/${current.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: current.payloadSnapshot,
        });
        const json = await response.json();
        if (!response.ok) {
          const message = json.error || "Failed to save project changes";
          current.onError?.({ code: json.code, message, status: response.status });
          throw new Error(message);
        }
        blockedSnapshotRef.current = null;
        lastSavedSnapshotRef.current = current.payloadSnapshot;
        setLastSaved(new Date());
        current.onSaved?.(json.project || null);
        return true;
      } catch (error) {
        blockedSnapshotRef.current = current.payloadSnapshot;
        toast({
          title: "Draft not saved",
          description: error instanceof Error ? error.message : "Please try saving again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    })();
    activeSave.current = request;
    try {
      return await request;
    } finally {
      activeSave.current = null;
    }
  }, []);

  useEffect(() => {
    if (initializeAsSaved && projectId && initializedProjectIdRef.current !== projectId) {
      lastSavedSnapshotRef.current = payloadSnapshot;
      initializedProjectIdRef.current = projectId;
      return;
    }
    if (!enabled || !projectId || isSaving ||
        payloadSnapshot === lastSavedSnapshotRef.current ||
        payloadSnapshot === blockedSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      // A manual save may have failed since this timer was scheduled.
      if (latest.current.payloadSnapshot !== blockedSnapshotRef.current) void flushSave();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [enabled, initializeAsSaved, isSaving, payloadSnapshot, projectId, flushSave]);

  return {
    isSaving,
    lastSaved,
    flushSave,
    setLastSavedSnapshot: (snapshot: string) => {
      lastSavedSnapshotRef.current = snapshot;
    },
  };
}
