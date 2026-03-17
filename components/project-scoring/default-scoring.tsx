"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { ScoringCriterion, Project } from "@/lib/types";
import { QuestionFactory } from "./question-types/question-factory";
import { getDefaultScores } from "./scoring-defaults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import Link from "next/link";
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

interface DefaultScoringProps {
  projectId: string;
  eventId: string;
  judgeId: string;
  trackId: string;
  finalistFeatureEnabled?: boolean;
  onScoreSaved?: () => void;
  onScoreDeleted?: () => void;
  hideProjectHeader?: boolean;
  className?: string;
}

interface FormValues {
  scores: Record<string, number | string>;
  comments: string;
  finalist_recommendation?: boolean;
}

export function DefaultScoring({
  projectId,
  eventId,
  judgeId,
  trackId,
  finalistFeatureEnabled = false,
  onScoreSaved,
  onScoreDeleted,
  hideProjectHeader = false,
  className = "",
}: DefaultScoringProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasExistingScore, setHasExistingScore] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    defaultValues: {
      scores: {},
      comments: "",
      finalist_recommendation: false,
    },
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch scoring criteria for this track
        const { data: trackData, error: trackError } = await supabase
          .from("event_tracks")
          .select("scoring_criteria")
          .eq("track_id", trackId)
          .single();

        if (trackError) throw trackError;

        if (trackData?.scoring_criteria?.criteria) {
          const trackCriteria = trackData.scoring_criteria
            .criteria as ScoringCriterion[];
          setCriteria(trackCriteria);

          form.reset({
            scores: getDefaultScores(trackCriteria),
            comments: "",
            finalist_recommendation: false,
          });
        }

        // Check if this project has already been scored by this judge
        const { data: existingScore, error: scoreError } = await supabase
          .from("project_scores")
          .select("scores, comments, finalist_recommendation")
          .eq("project_id", projectId)
          .eq("track_id", trackId)
          .eq("judge_id", judgeId)
          .maybeSingle();

        if (!scoreError && existingScore) {
          // Pre-fill the form with existing scores
          setHasExistingScore(true);
          form.reset({
            scores: existingScore.scores,
            comments: existingScore.comments || "",
            finalist_recommendation: !!existingScore.finalist_recommendation,
          });
        } else {
          setHasExistingScore(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load project data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId, trackId, judgeId, toast, form]);


  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);

    try {
      // Check if a score already exists
      const { data: existingScore, error: checkError } = await supabase
        .from("project_scores")
        .select("id")
        .eq("project_id", projectId)
        .eq("track_id", trackId)
        .eq("judge_id", judgeId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingScore) {
        // Update existing score
        const { error: updateError } = await supabase
          .from("project_scores")
          .update({
            scores: values.scores,
            comments: values.comments,
            finalist_recommendation: !!values.finalist_recommendation,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingScore.id);

        if (updateError) throw updateError;
      } else {
        // Insert new score
        const { error: insertError } = await supabase
          .from("project_scores")
          .insert({
            project_id: projectId,
            track_id: trackId,
            judge_id: judgeId,
            event_id: eventId,
            scores: values.scores,
            comments: values.comments,
            finalist_recommendation: !!values.finalist_recommendation,
          });

        if (insertError) throw insertError;
      }
      setHasExistingScore(true);
      onScoreSaved?.();

      toast({
        title: "Score submitted",
        description: "Your evaluation has been saved successfully.",
      });
    } catch (error) {
      console.error("Error submitting score:", error);
      toast({
        title: "Error",
        description: "Failed to save your evaluation",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteScore = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("project_scores")
        .delete()
        .eq("project_id", projectId)
        .eq("track_id", trackId)
        .eq("judge_id", judgeId);

      if (error) throw error;

      form.reset({
        scores: getDefaultScores(criteria),
        comments: "",
        finalist_recommendation: false,
      });
      setHasExistingScore(false);
      onScoreDeleted?.();

      toast({
        title: "Score deleted",
        description: "Your evaluation was removed successfully.",
      });
    } catch (error) {
      console.error("Error deleting score:", error);
      toast({
        title: "Error",
        description: "Failed to delete your evaluation",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Project not found</p>
      </div>
    );
  }

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
      {!hideProjectHeader && (
        <div>
          <h2 className="text-xl font-bold">
            <Link
              href={`/projects/public/${project.id}`}
              className="text-blue-600 hover:text-blue-700 hover:underline"
            >
              {project.project_name}
            </Link>
          </h2>
          <p className="text-gray-600">{project.project_description}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                id="finalist_recommendation"
                checked={!!form.watch("finalist_recommendation")}
                onCheckedChange={(checked) =>
                  form.setValue("finalist_recommendation", Boolean(checked))
                }
              />
              <label htmlFor="finalist_recommendation" className="text-sm">
                Recommend as Finalist
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting || deleting}>
              {submitting ? "Submitting..." : "Submit Evaluation"}
            </Button>
            {hasExistingScore && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="delete"
                    disabled={submitting || deleting}
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
                    <AlertDialogAction type="button" onClick={onDeleteScore}>
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
