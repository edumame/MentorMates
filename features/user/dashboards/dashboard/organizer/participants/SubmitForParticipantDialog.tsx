"use client";

import { useState } from "react";
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

interface SubmitForParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  participantUserId: string;
  participantDisplayName: string;
  onSubmitted?: () => void;
}

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
  const [submitImmediately, setSubmitImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectUrl("");
    setVideoUrl("");
    setSubmitImmediately(true);
  };

  const handleClose = (next: boolean) => {
    if (!next && !isSubmitting) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast({
        title: "Project name required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        participant_user_id: participantUserId,
        project: {
          project_name: projectName.trim(),
          project_description: projectDescription.trim() || undefined,
          project_url: projectUrl.trim() || undefined,
          video_url: videoUrl.trim() || undefined,
        },
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
        description: `Created ${projectName.trim()} for ${participantDisplayName}.`,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit project for {participantDisplayName}</DialogTitle>
          <DialogDescription>
            The participant will be assigned as the project lead. They can edit
            it afterwards from their profile.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="One or two sentences on what it does"
              maxLength={5000}
              rows={3}
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
            <Button type="submit" disabled={isSubmitting || !projectName.trim()}>
              {isSubmitting ? "Submitting..." : submitImmediately ? "Submit" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
