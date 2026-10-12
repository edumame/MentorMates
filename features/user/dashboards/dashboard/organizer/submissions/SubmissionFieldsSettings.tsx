"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { EventSubmissionField } from "@/lib/types";
import {
  SubmissionStep,
  apiFieldsToEditor,
  createSubmissionTemplateFields,
  fieldsToApiPayload,
  type SubmissionField,
} from "@/components/events/submission";

interface SubmissionFieldsSettingsProps {
  eventId: string;
}

export function SubmissionFieldsSettings({
  eventId,
}: SubmissionFieldsSettingsProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<SubmissionField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasConfiguredFields, setHasConfiguredFields] = useState(false);
  const editableFields =
    fields.length > 0 ? fields : createSubmissionTemplateFields();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/events/${eventId}/submission-fields`);
        if (!response.ok) {
          throw new Error("Failed to fetch submission fields");
        }

        const json = (await response.json()) as {
          fields?: EventSubmissionField[];
        };
        const activeFields = (json.fields || []).filter((field) => field.is_active);
        setHasConfiguredFields(activeFields.length > 0);
        setFields(
          activeFields.length > 0
            ? apiFieldsToEditor(activeFields)
            : []
        );
      } catch {
        toast({
          title: "Error",
          description: "Failed to load submission settings",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [eventId, toast]);

  const savePayload = useMemo(
    () => ({ fields: fieldsToApiPayload(editableFields) }),
    [editableFields]
  );

  const save = async () => {
    setIsSaving(true);
    try {
      const invalidField = editableFields.find(
        (field) => !field.label.trim() || !field.id.trim()
      );
      if (invalidField) {
        toast({
          title: "Validation error",
          description: "Each submission field needs a label and key.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/events/${eventId}/submission-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save submission settings");
      }

      const json = (await response.json()) as { fields?: EventSubmissionField[] };
      const activeFields = (json.fields || []).filter((field) => field.is_active);
      setHasConfiguredFields(activeFields.length > 0);
      setFields(
        activeFields.length > 0
          ? apiFieldsToEditor(activeFields)
          : []
      );

      toast({
        title: "Saved",
        description: hasConfiguredFields
          ? "Project submission fields updated."
          : "Project submission field configuration created.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Submission Form</CardTitle>
          <p className="text-sm text-muted-foreground">
            Collect project work from participants: project details, demos, and links.
            To ask people about joining the event, use Application form.
            Preview shows the form exactly as participants will see it.
          </p>
        </div>
        <Button className="shrink-0 whitespace-nowrap" onClick={save} disabled={isLoading || isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save form
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <SubmissionStep fields={fields} onChange={setFields} />
        )}
      </CardContent>
    </Card>
  );
}
