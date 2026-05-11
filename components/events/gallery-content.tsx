"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { Input } from "@/components/ui/input";
import { Copy, Download, Plus, QrCode, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { ProjectBoardContext, Project, EventRole } from "@/lib/types";
import { useToast } from "@/lib/hooks/use-toast";

interface GalleryContentProps {
  eventId: string;
  slug: string;
  hasJoined: boolean;
  userRole?: string | null;
  currentRole?: EventRole | null;
}

export function GalleryContent({
  eventId,
  slug,
  hasJoined,
  userRole,
  currentRole,
}: GalleryContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState(
    () => (typeof window !== "undefined" ? window.location.href : "")
  );
  const { toast } = useToast();
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/projects?eventId=${eventId}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
      }
      setIsLoading(false);
    };

    fetchProjects();
  }, [eventId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGalleryUrl(`${window.location.origin}/events/${slug}/gallery`);
    }
  }, [slug]);

  const filteredProjects = projects.filter(
    (project) =>
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const handleCopyLink = async () => {
    if (!galleryUrl) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({
        title: "Copy unavailable",
        description: "Clipboard access is not supported in this browser",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(galleryUrl);
      toast({
        title: "Link copied",
        description: "Gallery link copied to clipboard",
      });
    } catch (error) {
      console.error("Error copying gallery link:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy gallery link",
        variant: "destructive",
      });
    }
  };

  // Converts the rendered SVG into a canvas so we can copy/download the QR
  const getQrCanvas = async () => {
    const svg = qrWrapperRef.current?.querySelector(
      "svg"
    ) as SVGSVGElement | null;
    if (!svg) {
      throw new Error("QR code not ready yet");
    }

    const canvas = document.createElement("canvas");
    const size = svg.getBoundingClientRect().width || svg.clientWidth || 200;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context not available");
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(svgUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Failed to load QR image"));
      };
      img.src = svgUrl;
    });

    return canvas;
  };

  const handleCopyQr = async () => {
    try {
      const canvas = await getQrCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();

      if (typeof ClipboardItem === "undefined") {
        throw new Error("ClipboardItem not supported");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      toast({
        title: "QR copied",
        description: "QR code image copied to clipboard",
      });
    } catch (error) {
      console.error("Error copying QR code:", error);
      const failureDetail =
        error instanceof Error ? error.message : "Unable to copy QR code";
      if (
        galleryUrl &&
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        try {
          await navigator.clipboard.writeText(galleryUrl);
          toast({
            title: "Link copied instead",
            description:
              "QR image copy is not supported here, so we copied the gallery link.",
          });
          return;
        } catch (linkError) {
          console.error("Error copying fallback link:", linkError);
        }
      }

      toast({
        title: "Copy failed",
        description: failureDetail,
        variant: "destructive",
      });
    }
  };

  const handleDownloadQr = async () => {
    try {
      const canvas = await getQrCanvas();
      const link = document.createElement("a");
      link.download = "gallery-share-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Download started",
        description: "QR code saved as PNG",
      });
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: "Download failed",
        description:
          error instanceof Error ? error.message : "Unable to download QR code",
        variant: "destructive",
      });
    }
  };

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
      <ProjectBoard
        isLoading={isLoading}
        projectList={filteredProjects}
        projectBoardContext={ProjectBoardContext.EventGallery}
      />

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <QrCode className="h-5 w-5" />
              Share this gallery
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Share the public gallery with attendees or display the QR code at
              your event booth.
            </p>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Public link
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={galleryUrl}
                  readOnly
                  className="flex-1 bg-white"
                />
                <Button
                  variant="secondary"
                  className="bg-zinc-100 hover:bg-zinc-200"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy link
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  QR code
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div
                  ref={qrWrapperRef}
                  className="p-4 border border-zinc-200 rounded-2xl bg-white flex items-center justify-center"
                >
                  <QRCodeSVG
                    value={
                      galleryUrl ||
                      (typeof window !== "undefined"
                        ? window.location.href
                        : "")
                    }
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleCopyQr}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy QR
                  </Button>
                  <Button variant="outline" onClick={handleDownloadQr}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PNG
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
