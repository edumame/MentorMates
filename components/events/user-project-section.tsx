"use client";

import Link from "next/link";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Edit, Eye, Clock, FolderPlus } from "lucide-react";

interface UserProject {
  id: string;
  project_name: string | null;
  project_description: string | null;
  cover_image_url: string | null;
  submitted: boolean | null;
  submitted_at: string | null;
  created_at: string | null;
}

interface UserProjectSectionProps {
  projects: UserProject[];
  eventId: string;
  eventSlug?: string | null;
  submissionDeadline?: string | null;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDeadlineStatus(deadline: string | null | undefined): {
  label: string;
  urgent: boolean;
} | null {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { label: "Submission closed", urgent: false };
  }

  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays >= 1) {
    return { label: `${diffDays} day${diffDays > 1 ? "s" : ""} left to edit`, urgent: false };
  }
  return { label: `${diffHours}h left to edit`, urgent: true };
}

export function UserProjectSection({
  projects,
  eventId,
  eventSlug,
  submissionDeadline,
}: UserProjectSectionProps) {
  const eventPath = eventSlug || eventId;
  const deadline = getDeadlineStatus(submissionDeadline);

  // No project yet — show empty state with CTA
  if (projects.length === 0) {
    return (
      <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50 mb-6">
        <CardContent className="px-6 pt-6 pb-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <FolderPlus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">
                You haven&apos;t created a project yet
              </p>
              <p className="text-sm text-slate-600">
                Submit your project to this event to participate
              </p>
            </div>
          </div>
          <Link href={`/events/${eventPath}/submit`}>
            <Button>Submit Project</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {projects.length === 1 ? "Your Project" : "Your Projects"}
        </h2>
        {deadline && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              deadline.urgent ? "text-orange-600" : "text-slate-500"
            }`}
          >
            <Clock className="h-3 w-3" />
            {deadline.label}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="flex">
                {project.cover_image_url ? (
                  <div className="relative h-30 w-24 flex-shrink-0 bg-slate-100">
                    <CoverImageWithFallback
                      src={project.cover_image_url}
                      alt={project.project_name || "Project cover"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-30 w-24 flex-shrink-0 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">
                      {(project.project_name || "P").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-slate-900 truncate">
                      {project.project_name || "Untitled project"}
                    </p>
                    {project.submitted ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 shrink-0">
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Created at {formatRelativeTime(project.created_at)}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/projects/${project.id}/edit`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/projects/${project.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
