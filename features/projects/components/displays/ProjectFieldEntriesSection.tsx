"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type {
  EventSubmissionField,
  ProjectFieldEntry,
  ProjectFieldEntryAttachment,
} from "@/lib/types";

const MAX_ATTACHMENTS_PER_ENTRY = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

interface ProjectFieldEntriesSectionProps {
  projectId: string;
  /** Whether the viewer may add entries (team member / organizer on the private route). */
  canContribute?: boolean;
}

interface FieldEntriesResponse {
  fields: EventSubmissionField[];
  entries: ProjectFieldEntry[];
  viewerUserId: string | null;
}

function formatEntryTimestamp(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function uploadEntryAttachment(projectId: string, file: File) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `field-entries/${projectId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("project-materials")
    .upload(filePath, file);

  if (uploadError) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-materials").getPublicUrl(filePath);

  return { name: file.name, url: publicUrl } satisfies ProjectFieldEntryAttachment;
}

export function ProjectFieldEntriesSection({
  projectId,
  canContribute = false,
}: ProjectFieldEntriesSectionProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<EventSubmissionField[]>([]);
  const [entries, setEntries] = useState<ProjectFieldEntry[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftAttachments, setDraftAttachments] = useState<
    Record<string, ProjectFieldEntryAttachment[]>
  >({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/field-entries`);
        if (!response.ok) {
          throw new Error("Failed to fetch entries");
        }
        const json = (await response.json()) as FieldEntriesResponse;
        if (!cancelled) {
          setFields(json.fields || []);
          setEntries(json.entries || []);
          setViewerUserId(json.viewerUserId ?? null);
        }
      } catch {
        // Leave the section empty on failure — it renders nothing below.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const attachFiles = useCallback(
    async (fieldId: string, fileList: FileList | null) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) {
        return;
      }

      const existing = draftAttachments[fieldId] || [];
      if (existing.length + files.length > MAX_ATTACHMENTS_PER_ENTRY) {
        toast({
          title: "Too many files",
          description: `An entry can have at most ${MAX_ATTACHMENTS_PER_ENTRY} attachments.`,
          variant: "destructive",
        });
        return;
      }

      const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
      if (oversized) {
        toast({
          title: "File too large",
          description: `"${oversized.name}" exceeds the 10 MB limit.`,
          variant: "destructive",
        });
        return;
      }

      setUploadingFieldId(fieldId);
      try {
        const uploaded: ProjectFieldEntryAttachment[] = [];
        for (const file of files) {
          const attachment = await uploadEntryAttachment(projectId, file);
          if (!attachment) {
            toast({
              title: "Upload Error",
              description: `Failed to upload "${file.name}"`,
              variant: "destructive",
            });
            continue;
          }
          uploaded.push(attachment);
        }

        if (uploaded.length > 0) {
          setDraftAttachments((previous) => ({
            ...previous,
            [fieldId]: [...(previous[fieldId] || []), ...uploaded],
          }));
        }
      } finally {
        setUploadingFieldId(null);
        const input = fileInputRefs.current[fieldId];
        if (input) {
          input.value = "";
        }
      }
    },
    [draftAttachments, projectId, toast],
  );

  const removeDraftAttachment = useCallback(
    (fieldId: string, url: string) => {
      setDraftAttachments((previous) => ({
        ...previous,
        [fieldId]: (previous[fieldId] || []).filter(
          (attachment) => attachment.url !== url,
        ),
      }));
    },
    [],
  );

  const addEntry = useCallback(
    async (fieldId: string) => {
      const content = (drafts[fieldId] || "").trim();
      const attachments = draftAttachments[fieldId] || [];
      if (!content && attachments.length === 0) {
        return;
      }

      setSavingFieldId(fieldId);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/field-entries`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fieldId,
              ...(content ? { content } : {}),
              ...(attachments.length > 0 ? { attachments } : {}),
            }),
          },
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || "Failed to add entry");
        }

        setEntries((previous) => [...previous, json.entry as ProjectFieldEntry]);
        setDrafts((previous) => ({ ...previous, [fieldId]: "" }));
        setDraftAttachments((previous) => ({ ...previous, [fieldId]: [] }));
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to add entry",
          variant: "destructive",
        });
      } finally {
        setSavingFieldId(null);
      }
    },
    [drafts, draftAttachments, projectId, toast],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      setDeletingEntryId(entryId);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/field-entries/${entryId}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error(json.error || "Failed to delete entry");
        }
        setEntries((previous) =>
          previous.filter((entry) => entry.id !== entryId),
        );
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to delete entry",
          variant: "destructive",
        });
      } finally {
        setDeletingEntryId(null);
      }
    },
    [projectId, toast],
  );

  if (isLoading || fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const fieldEntries = entries.filter(
          (entry) => entry.event_submission_field_id === field.id,
        );
        const pendingAttachments = draftAttachments[field.id] || [];
        const hasDraft =
          Boolean((drafts[field.id] || "").trim()) ||
          pendingAttachments.length > 0;

        return (
          <Card key={field.id}>
            <CardHeader>
              <CardTitle className="text-lg">{field.label}</CardTitle>
              {field.description ? (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {fieldEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {fieldEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {entry.content ? (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {entry.content}
                            </p>
                          ) : null}
                          {(entry.attachments || []).length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {(entry.attachments || []).map((attachment) => (
                                <li key={attachment.url}>
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm text-[#4b89ef] hover:underline break-all"
                                  >
                                    <Paperclip className="size-3.5 shrink-0" />
                                    {attachment.name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {entry.submitter_display_name || "Teammate"} ·{" "}
                            {formatEntryTimestamp(entry.created_at)}
                          </p>
                        </div>
                        {viewerUserId === entry.submitter_user_id && (
                          <button
                            type="button"
                            onClick={() => void deleteEntry(entry.id)}
                            disabled={deletingEntryId === entry.id}
                            aria-label="Delete entry"
                            className="shrink-0 rounded-md p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                          >
                            {deletingEntryId === entry.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {canContribute && (
                <div className="space-y-2">
                  <Textarea
                    value={drafts[field.id] || ""}
                    onChange={(e) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [field.id]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder || "Add an entry…"}
                    rows={3}
                    maxLength={5000}
                  />

                  {pendingAttachments.length > 0 && (
                    <ul className="space-y-1">
                      {pendingAttachments.map((attachment) => (
                        <li
                          key={attachment.url}
                          className="flex items-center gap-1.5 text-sm text-gray-700"
                        >
                          <Paperclip className="size-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              removeDraftAttachment(field.id, attachment.url)
                            }
                            aria-label={`Remove ${attachment.name}`}
                            className="rounded-md p-0.5 text-gray-400 hover:text-red-500"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void addEntry(field.id)}
                      disabled={
                        savingFieldId === field.id ||
                        uploadingFieldId === field.id ||
                        !hasDraft
                      }
                    >
                      {savingFieldId === field.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Add entry
                    </Button>
                    <input
                      ref={(element) => {
                        fileInputRefs.current[field.id] = element;
                      }}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => void attachFiles(field.id, e.target.files)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRefs.current[field.id]?.click()}
                      disabled={
                        uploadingFieldId === field.id ||
                        savingFieldId === field.id ||
                        pendingAttachments.length >= MAX_ATTACHMENTS_PER_ENTRY
                      }
                    >
                      {uploadingFieldId === field.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Paperclip className="mr-2 size-4" />
                      )}
                      Attach file
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
