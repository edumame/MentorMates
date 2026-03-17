"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import { EventSubmissionField, SubmissionFieldType } from "@/lib/types";
import { Loader2 } from "lucide-react";

type EditableField = {
  id?: string;
  key: string;
  label: string;
  description: string;
  placeholder: string;
  field_type: SubmissionFieldType;
  required: boolean;
  is_active: boolean;
  options: string[];
};

interface SubmissionFieldsSettingsProps {
  eventId: string;
}

const slugifyKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const emptyField = (): EditableField => ({
  key: "",
  label: "",
  description: "",
  placeholder: "",
  field_type: "short_text",
  required: false,
  is_active: true,
  options: [],
});

export function SubmissionFieldsSettings({
  eventId,
}: SubmissionFieldsSettingsProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<EditableField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        const mapped = (json.fields || []).map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          description: field.description || "",
          placeholder: field.placeholder || "",
          field_type: field.field_type,
          required: field.required,
          is_active: field.is_active,
          options: Array.isArray(field.options) ? field.options as string[] : [],
        }));
        setFields(mapped);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load submission settings",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [eventId, toast]);

  const updateField = (index: number, patch: Partial<EditableField>) => {
    setFields((prev) =>
      prev.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field
      )
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const payload = {
        fields: fields.map((field, index) => ({
          id: field.id,
          key: field.key.trim() || slugifyKey(field.label),
          label: field.label.trim(),
          description: field.description.trim() || null,
          placeholder: field.placeholder.trim() || null,
          field_type: field.field_type,
          required: field.required,
          is_active: field.is_active,
          sort_order: index,
          options: field.options.length > 0 ? field.options : undefined,
        })),
      };

      const invalid = payload.fields.find((field) => !field.label || !field.key);
      if (invalid) {
        toast({
          title: "Validation error",
          description: "Each custom question needs a label and key.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/events/${eventId}/submission-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save submission settings");
      }
      const json = (await response.json()) as { fields?: EventSubmissionField[] };
      setFields(
        (json.fields || []).map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          description: field.description || "",
          placeholder: field.placeholder || "",
          field_type: field.field_type,
          required: field.required,
          is_active: field.is_active,
          options: Array.isArray(field.options) ? field.options as string[] : [],
        }))
      );

      toast({
        title: "Saved",
        description: "Project submission questions updated.",
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
    <Card>
      <CardHeader>
        <CardTitle>Submission Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Configure optional custom questions for project submissions.
            </p>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id || `draft-${index}`}
                  className="rounded-md border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label>Question {index + 1}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fields.length - 1}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setFields((prev) =>
                            prev.filter((_, fieldIndex) => fieldIndex !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={field.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      updateField(index, {
                        label,
                        key: field.key || slugifyKey(label),
                      });
                    }}
                    placeholder="Question label"
                  />
                  <Input
                    value={field.key}
                    onChange={(e) =>
                      updateField(index, {
                        key: slugifyKey(e.target.value),
                      })
                    }
                    placeholder="question_key"
                  />
                  <Textarea
                    value={field.description}
                    onChange={(e) =>
                      updateField(index, { description: e.target.value })
                    }
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <Input
                    value={field.placeholder}
                    onChange={(e) =>
                      updateField(index, { placeholder: e.target.value })
                    }
                    placeholder="Placeholder text (optional)"
                  />
                  {(field.field_type === "select" || field.field_type === "multi_select") && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                      <Textarea
                        value={field.options.join("\n")}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value.split("\n").filter((o) => o.trim()),
                          })
                        }
                        placeholder={"Option 1\nOption 2\nOption 3"}
                        rows={3}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div className="sm:col-span-2">
                      <Select
                        value={field.field_type}
                        onValueChange={(value: SubmissionFieldType) =>
                          updateField(index, { field_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short_text">Short Text</SelectItem>
                          <SelectItem value="long_text">Long Text</SelectItem>
                          <SelectItem value="url">Single URL</SelectItem>
                          <SelectItem value="multi_url">Multiple URLs</SelectItem>
                          <SelectItem value="file">File Upload</SelectItem>
                          <SelectItem value="select">Single Choice</SelectItem>
                          <SelectItem value="multi_select">Multi Select</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(index, { required: checked })
                        }
                      />
                      <Label>Required</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="defaultGray"
                className="gap-1.5 px-3"
                onClick={() => setFields((prev) => [...prev, emptyField()])}
              >
                Add question
              </Button>
              <Button type="button" onClick={save} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save questions"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

