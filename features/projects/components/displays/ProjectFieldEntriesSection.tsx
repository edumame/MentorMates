"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import type { EventSubmissionField, ProjectFieldEntry } from "@/lib/types";

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
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

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

  const addEntry = useCallback(
    async (fieldId: string) => {
      const content = (drafts[fieldId] || "").trim();
      if (!content) {
        return;
      }

      setSavingFieldId(fieldId);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/field-entries`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fieldId, content }),
          },
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || "Failed to add entry");
        }

        setEntries((previous) => [...previous, json.entry as ProjectFieldEntry]);
        setDrafts((previous) => ({ ...previous, [fieldId]: "" }));
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
    [drafts, projectId, toast],
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
                        <div className="min-w-0">
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {entry.content}
                          </p>
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
                  <Button
                    size="sm"
                    onClick={() => void addEntry(field.id)}
                    disabled={
                      savingFieldId === field.id ||
                      !(drafts[field.id] || "").trim()
                    }
                  >
                    {savingFieldId === field.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Add entry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
