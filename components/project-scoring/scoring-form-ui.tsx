"use client";

import { ScoringCriterion } from "@/lib/types";
import { QuestionFactory } from "./question-types/question-factory";
import { getDefaultScores } from "./scoring-defaults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FormValues {
  scores: Record<string, number | string>;
  comments: string;
  finalist_recommendation?: boolean;
}

/**
 * Pure presentation component for the scoring form.
 *
 * Renders criteria sliders, comments textarea, and submit/delete buttons
 * WITHOUT any Supabase fetching or writing. Data is passed in via props.
 *
 * Used by:
 * - DefaultScoring (real judge view, passes live data)
 * - JudgePreviewDeck (organizer preview, passes dummy data)
 */
export interface ScoringFormUIProps {
  criteria: ScoringCriterion[];
  initialScores?: Record<string, number | string>;
  initialComments?: string;
  initialFinalist?: boolean;
  hasExistingScore?: boolean;
  finalistFeatureEnabled?: boolean;
  submitting?: boolean;
  deleting?: boolean;
  /** Called when the form is submitted. If not provided, the submit button is a no-op (preview mode). */
  onSubmit?: (values: FormValues) => void;
  /** Called when the delete button is clicked. If not provided, delete is hidden or a no-op. */
  onDelete?: () => void;
  /** When true, form actions are disabled and a "Preview" badge shows. */
  previewMode?: boolean;
  className?: string;
}

export function ScoringFormUI({
  criteria,
  initialScores,
  initialComments = "",
  initialFinalist = false,
  hasExistingScore = false,
  finalistFeatureEnabled = false,
  submitting = false,
  deleting = false,
  onSubmit,
  onDelete,
  previewMode = false,
  className = "",
}: ScoringFormUIProps) {
  const form = useForm<FormValues>({
    defaultValues: {
      scores: initialScores ?? getDefaultScores(criteria),
      comments: initialComments,
      finalist_recommendation: initialFinalist,
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (onSubmit) onSubmit(values);
  };

  if (criteria.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-yellow-600">
          No scoring criteria defined for this track.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-4">
            {criteria.map((criterion) => (
              <FormField
                key={criterion.id}
                control={form.control}
                name={`scores.${criterion.id}`}
                render={({ field }) => (
                  <QuestionFactory
                    criterion={criterion}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </div>

          <FormItem>
            <FormLabel>Comments</FormLabel>
            <Textarea
              placeholder="Add any additional feedback for this project..."
              {...form.register("comments")}
              className="min-h-32"
            />
          </FormItem>

          {finalistFeatureEnabled && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="finalist_recommendation_preview"
                checked={!!form.watch("finalist_recommendation")}
                onCheckedChange={(checked) =>
                  form.setValue("finalist_recommendation", Boolean(checked))
                }
              />
              <label
                htmlFor="finalist_recommendation_preview"
                className="text-sm"
              >
                Recommend as Finalist
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={submitting || deleting || previewMode}
            >
              {submitting
                ? "Submitting..."
                : previewMode
                  ? "Submit Evaluation (preview)"
                  : "Submit Evaluation"}
            </Button>
            {hasExistingScore && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={submitting || deleting || previewMode}
                  >
                    {deleting ? "Deleting..." : "Delete Evaluation"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Evaluation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Delete your score for this track? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction type="button" onClick={onDelete}>
                      Delete Evaluation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
