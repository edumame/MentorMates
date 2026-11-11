"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { Plus, Share2 } from "lucide-react";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { ProjectBoardContext, Project, EventRole } from "@/lib/types";
import { ShareQrDialog } from "./share-qr-dialog";

interface GalleryContentProps {
  eventId: string;
  slug: string;
  hasJoined: boolean;
  /** Signed-out viewers must use the public listing; the default one is 401 for them (NEW-005). */
  isSignedIn: boolean;
  userRole?: string | null;
  currentRole?: EventRole | null;
}

/**
 * Signed-in viewers use the authenticated listing (RLS decides what they see,
 * organizers also get drafts); signed-out viewers use the public listing,
 * which only serves submitted projects of public events.
 */
export function galleryProjectsUrl(eventId: string, isSignedIn: boolean) {
  const base = `/api/projects?eventId=${encodeURIComponent(eventId)}`;
  return isSignedIn ? base : `${base}&public=true`;
}

export function GalleryContent({
  eventId,
  slug,
  hasJoined,
  isSignedIn,
  userRole,
  currentRole,
}: GalleryContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState(
    () => (typeof window !== "undefined" ? window.location.href : "")
  );

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const response = await fetch(galleryProjectsUrl(eventId, isSignedIn));
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
        // Show an error rather than the empty board: a failed load (e.g. a
        // signed-out visitor of a private event gets 404) is not "no projects".
        setLoadFailed(true);
      }
      setIsLoading(false);
    };

    fetchProjects();
  }, [eventId, isSignedIn]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Shared and printed links outlive a slug rename, so use the immutable id.
      setGalleryUrl(`${window.location.origin}/events/${eventId}/gallery`);
    }
  }, [eventId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 w-full">
      {/* Search + Share */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <EventSearchInput
          wrapperClassName="w-full sm:max-w-[560px]"
          placeholder="Search projects by name or team members"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          inputClassName="text-[16px] leading-[1.5] sm:text-[16px]"
        />

        <Button
          variant="outline"
          className="w-full sm:w-auto border-[1.5px] border-[rgba(0,0,0,0.1)]"
          onClick={() => setIsShareDialogOpen(true)}
        >
          <Share2 className="h-5 w-5 mr-2" />
          Share Gallery
        </Button>
      </div>

      {/* Create Project Button - Only show for participants and organizers */}
      {hasJoined &&
        currentRole === EventRole.Participant &&
        (userRole === EventRole.Organizer ||
          userRole === EventRole.Participant) && (
          <div className="mb-6">
            <Link href={`/projects/submit?eventId=${slug}`}>
              <Button className="button-gradient text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </div>
        )}

      {/* Project Board */}
      {loadFailed ? (
        <div
          role="alert"
          className="mx-auto w-full max-w-[820px] rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-4 py-3 text-sm text-black/70"
        >
          Couldn’t load projects for this event. It may be private or
          unavailable.
        </div>
      ) : (
        <ProjectBoard
          isLoading={isLoading}
          projectList={filteredProjects}
          projectBoardContext={ProjectBoardContext.EventGallery}
        />
      )}

      <ShareQrDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        url={galleryUrl}
        title="Share this gallery"
        description="Share the public gallery with attendees or display the QR code at your event booth."
        downloadFileName="gallery-share-qr.png"
      />
    </div>
  );
}
