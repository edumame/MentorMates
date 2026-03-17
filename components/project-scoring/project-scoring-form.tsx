"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScoreFormData, ScoringCriterion } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/hooks/use-toast";
import { PostgrestError } from "@supabase/supabase-js";
import VoiceInput from "@/components/utils/VoiceInput";
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

interface ProjectScoringFormProps {
  projectId: string;
  trackId: string;
  criteria: ScoringCriterion[];
  onScoreSubmitted: () => void;
  defaultMin?: number;
  defaultMax?: number;
  finalistFeatureEnabled?: boolean;
}

interface ProjectData {
  projects: {
    id: string;
    event_id: string;
  };
}

export function ProjectScoringForm({
  projectId,
  trackId,
  criteria,
  onScoreSubmitted,
  defaultMin = 0,
  defaultMax = 10,
  finalistFeatureEnabled = false,
}: ProjectScoringFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingScore, setHasExistingScore] = useState(false);
  const [formData, setFormData] = useState<ScoreFormData>(() => {
    // Initialize scores with default values
    const initialScores: Record<string, number | string> = {};
    criteria.forEach((criterion) => {
      initialScores[criterion.id] = Math.floor(
        ((criterion.max ?? defaultMax) + (criterion.min ?? defaultMin)) / 2
      );
    });

    return {
      scores: initialScores,
      comments: "",
      finalist_recommendation: false,
    };
  });

  useEffect(() => {
    // Reset form data when track changes
    const initialScores: Record<string, number | string> = {};
    criteria.forEach((criterion) => {
      initialScores[criterion.id] = Math.floor(
        ((criterion.max ?? defaultMax) + (criterion.min ?? defaultMin)) / 2
      );
    });
    setFormData({
      scores: initialScores,
      comments: "",
      finalist_recommendation: false,
    });
    setHasExistingScore(false);

    // Only fetch existing score if trackId is provided
    if (!trackId) {
      setIsLoading(false);
      return;
    }

    const fetchExistingScore = async () => {
      setIsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data: scoreData, error: scoreError } = await supabase
          .from("project_scores")
          .select("scores, comments, finalist_recommendation")
          .eq("project_id", projectId)
          .eq("track_id", trackId)
          .eq("judge_id", session.user.id)
          .single();

        if (scoreError) {
          if (scoreError.code !== "PGRST116") {
            // Not Found error code
            console.error("Error fetching existing score:", scoreError);
            toast({
              title: "Error",
              description: "Failed to fetch existing score",
              variant: "destructive",
            });
          }
          return;
        }

        if (scoreData) {
          setHasExistingScore(true);
          setFormData({
            scores: scoreData.scores,
            comments: scoreData.comments || "",
            finalist_recommendation: !!scoreData.finalist_recommendation,
          });
        }
      } catch (error) {
        console.error("Error fetching score:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingScore();
  }, [projectId, trackId, criteria, defaultMax, defaultMin]);

  const handleScoreChange = (criterionId: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      scores: {
        ...prev.scores,
        [criterionId]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to submit scores",
          variant: "destructive",
        });
        return;
      }

      // First verify the project exists and has this track
      const { data: projectData, error: projectError } = (await supabase
        .from("project_tracks")
        .select(
          `
          projects!inner (
            id,
            event_id
          )
        `
        )
        .eq("project_id", projectId)
        .eq("track_id", trackId)
        .single()) as {
        data: ProjectData | null;
        error: PostgrestError | null;
      };

      if (projectError || !projectData?.projects?.event_id) {
        toast({
          title: "Error",
          description: "Project not found or not assigned to this track",
          variant: "destructive",
        });
        return;
      }

      // Submit the score
      const { error } = await supabase.from("project_scores").upsert(
        {
          project_id: projectId,
          judge_id: session.user.id,
          track_id: trackId,
          event_id: projectData.projects.event_id,
          scores: formData.scores,
          comments: formData.comments,
          finalist_recommendation: !!formData.finalist_recommendation,
          updated_at: new Date(),
        },
        {
          onConflict: "project_id,judge_id,track_id",
        }
      );

      if (error) throw error;
      setHasExistingScore(true);

      toast({
        title: "Success",
        description: "Project score submitted successfully",
      });

      onScoreSubmitted();
    } catch (error) {
      console.error("Error submitting score:", error);
      toast({
        title: "Error",
        description: "Failed to submit score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScore = async () => {
    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to delete scores",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("project_scores")
        .delete()
        .eq("project_id", projectId)
        .eq("track_id", trackId)
        .eq("judge_id", session.user.id);

      if (error) throw error;

      const resetScores: Record<string, number | string> = {};
      criteria.forEach((criterion) => {
        resetScores[criterion.id] = Math.floor(
          ((criterion.max ?? defaultMax) + (criterion.min ?? defaultMin)) / 2
        );
      });

      setFormData({
        scores: resetScores,
        comments: "",
        finalist_recommendation: false,
      });
      setHasExistingScore(false);

      toast({
        title: "Score deleted",
        description: "Your score for this project track has been removed.",
      });
      onScoreSubmitted();
    } catch (error) {
      console.error("Error deleting score:", error);
      toast({
        title: "Error",
        description: "Failed to delete score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div>Loading existing scores...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {criteria.map((criterion) => (
        <div key={criterion.id} className="space-y-2">
          <div className="flex justify-between items-baseline">
            <label className="text-sm font-medium">
              {criterion.name}
              {criterion.weight && (
                <span className="text-gray-500 ml-2">
                  (Weight: {criterion.weight * 100}%)
                </span>
              )}
            </label>
            <span className="text-sm text-gray-500">
              Score: {formData.scores[criterion.id]}
            </span>
          </div>
          <p className="text-sm text-gray-600">{criterion.description}</p>
          <input
            type="range"
            min={criterion.min ?? defaultMin}
            max={criterion.max ?? defaultMax}
            value={formData.scores[criterion.id]}
            onChange={(e) =>
              handleScoreChange(criterion.id, parseInt(e.target.value))
            }
            className="w-full"
          />
        </div>
      ))}

      <div className="space-y-2 px-2">
        <label className="text-sm font-medium">Comments</label>
        <Textarea
          value={formData.comments}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, comments: e.target.value }))
          }
          placeholder="Add any comments about your scoring decisions..."
          className="min-h-[100px]"
        />

        {/* Voice Input; editing the function to be compatible with setText typing; settext accepts a string or a function that returns a string */}
        <VoiceInput
          setText={(text: string | ((prevText: string) => string)) => {
            const newText =
              typeof text === "function" ? text(formData.comments || "") : text;
            setFormData((prev) => ({ ...prev, comments: newText }));
          }}
        />
      </div>

      {finalistFeatureEnabled && (
        <div className="flex items-center gap-2 px-2">
          <Checkbox
            id="finalist_recommendation"
            checked={!!formData.finalist_recommendation}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                finalist_recommendation: Boolean(checked),
              }))
            }
          />
          <label htmlFor="finalist_recommendation" className="text-sm">
            Recommend as Finalist
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || isDeleting || !trackId}>
          {isSubmitting ? "Submitting..." : "Submit Score"}
        </Button>
        {hasExistingScore && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="delete"
                disabled={isSubmitting || isDeleting || !trackId}
              >
                {isDeleting ? "Deleting..." : "Delete Score"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Score</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete your score for this track? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction type="button" onClick={handleDeleteScore}>
                  Delete Score
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
}
