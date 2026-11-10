"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Copy, Loader, Plus, Printer, Trophy } from "lucide-react";
import { Prize, Project } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { buildShareCaption } from "@/features/projects/components/displays/ProjectShareSection";
import { pickCertificateSubject } from "./subject";

interface CertificateEvent {
  event_name: string;
  event_date: string | null;
  location: string | null;
}

export default function CertificatePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  // ?m=<member id> pins the certificate to a specific team member (shareable
  // logged-out). Legacy links used ?p=<email>; those are resolved server-side
  // to a member id and rewritten so the email stops circulating.
  const memberParam = searchParams.get("m");
  const legacyEmailParam = searchParams.get("p")?.toLowerCase() ?? null;

  const [project, setProject] = useState<Project | null>(null);
  const [event, setEvent] = useState<CertificateEvent | null>(null);
  const [legacyMemberId, setLegacyMemberId] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Public endpoint first so certificates work logged-out; fall back to
        // the authenticated endpoint for private-event team members/organizers.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setViewerId(user?.id ?? null);

        let p: Project | null = null;
        // The authenticated endpoint only helps signed-in members of private
        // events; signed-out viewers would just get a 401.
        // Malformed ids can't match a project: show not-found without a request.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
        const urls = !isUuid ? [] : [
          `/api/projects?public=true&projectId=${encodeURIComponent(projectId)}`,
          ...(user ? [`/api/projects?projectId=${encodeURIComponent(projectId)}`] : []),
        ];
        for (const url of urls) {
          const response = await fetch(url);
          const payload = (await response.json().catch(() => ({}))) as {
            project?: Project;
          };
          if (response.ok && payload.project) {
            p = payload.project;
            break;
          }
        }
        setProject(p);

        // Legacy ?p=<email> links: never resolved for anyone else (that would
        // confirm team membership for a guessed email). Only a signed-in
        // viewer whose own verified email is ?p= is pinned (to themselves);
        // everyone else gets the generic certificate. The email is then
        // removed from the URL.
        if (legacyEmailParam) {
          const ownLink =
            Boolean(user?.email) && user!.email!.toLowerCase() === legacyEmailParam;
          setLegacyMemberId(ownLink ? user!.id : null);
          router.replace(
            ownLink
              ? `/certificate/${projectId}?m=${encodeURIComponent(user!.id)}`
              : `/certificate/${projectId}`,
          );
        }

        if (p?.event_id) {
          const { data: eventData } = await supabase
            .from("events")
            .select("event_name, event_date, location")
            .eq("event_id", p.event_id)
            .single();
          if (eventData) {
            setEvent({
              event_name: eventData.event_name,
              event_date: eventData.event_date ?? null,
              location: eventData.location ?? null,
            });
          }
        }
      } catch {
        // handled by the empty state below
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // legacyEmailParam is consumed once and then removed from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const teamMembers = useMemo(
    () => project?.team_members ?? [],
    [project?.team_members],
  );

  // Whose name goes on the certificate: ?m= param → signed-in teammate → project lead
  const subject = useMemo(
    () => pickCertificateSubject(teamMembers, memberParam ?? legacyMemberId, viewerId),
    [teamMembers, memberParam, legacyMemberId, viewerId],
  );

  // Tier: winner (prize assigned) > finalist (advanced past round 1) > participant
  const isWinner = (project?.prizes_won?.length ?? 0) > 0;
  const isFinalist = !isWinner && !!project?.is_finalist;
  const rawPrize = project?.prizes_won?.[0] as
    | (Prize & { prizes?: { prize_description?: string } })
    | undefined;
  const prizeDescription =
    rawPrize?.prize_description ?? rawPrize?.prizes?.prize_description ?? null;
  const tier = isWinner ? "winner" : isFinalist ? "finalist" : "participant";
  const certTitle =
    tier === "winner"
      ? "Certificate of Achievement"
      : tier === "finalist"
        ? "Certificate of Distinction"
        : "Certificate of Participation";
  const roleLabel =
    tier === "winner" ? "Winner" : tier === "finalist" ? "Finalist" : "Builder";

  const certUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = `${window.location.origin}/certificate/${projectId}`;
    return subject?.id ? `${base}?m=${encodeURIComponent(subject.id)}` : base;
  }, [projectId, subject]);

  const issueDate = event?.event_date ? new Date(event.event_date) : null;

  const handleAddToLinkedIn = () => {
    if (!event) return;
    const url =
      "https://www.linkedin.com/profile/add?startTask=CERTIFICATION" +
      `&name=${encodeURIComponent(`${roleLabel} — ${event.event_name}`)}` +
      "&organizationName=MentorMates" +
      (issueDate
        ? `&issueYear=${issueDate.getFullYear()}&issueMonth=${issueDate.getMonth() + 1}`
        : "") +
      `&certUrl=${encodeURIComponent(certUrl)}`;
    window.open(url, "_blank");
  };

  const handleShareCert = (platform: "linkedin" | "twitter") => {
    if (!project) return;
    const caption = buildShareCaption({
      projectName: project.project_name,
      eventName: event?.event_name,
      teamNames: teamMembers.map((member) => member.display_name),
      videoUrl: project.video_url,
      url: certUrl,
    });
    const intent =
      platform === "linkedin"
        ? `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`
        : `https://x.com/intent/tweet?text=${encodeURIComponent(caption)}`;
    window.open(intent, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!project || !project.submitted || !subject) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Award className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Certificate not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Certificates are issued for submitted projects. If this is your
          project, make sure it has been submitted — or if you think this is
          a mistake, try refreshing the page.
        </p>
        <Link
          href={`/projects/public/${projectId}`}
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          View project
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Print: show only the certificate, no shadows (they rasterize gray in PDF) */}
      <style>{`
        @media print {
          header, nav, footer, .no-print { display: none !important; }
          body { background: #fff !important; }
          .certificate-card { box-shadow: none !important; border-radius: 0 !important; }
          @page { size: 11in 8.5in; margin: 0.4in; }
        }
      `}</style>

      <div className="certificate-card rounded-xl border-4 border-double border-neutral-800 bg-white p-6 text-center shadow-sm sm:p-10 md:p-14">
        <Image
          src="/mentormate.png"
          alt="MentorMates"
          width={180}
          height={48}
          className="mx-auto mb-8 h-10 w-auto object-contain"
        />
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          {certTitle}
        </p>
        <p className="mt-8 text-sm text-neutral-600">This certifies that</p>
        <h1 className="mt-2 break-words font-serif text-2xl font-semibold text-neutral-900 sm:text-4xl">
          {subject.name}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-neutral-700">
          {tier === "winner"
            ? "won recognition for building"
            : tier === "finalist"
              ? "was selected as a finalist for building"
              : "built and submitted"}{" "}
          <span className="break-words font-semibold">
            {project.project_name}
          </span>
          {event ? (
            <>
              {" "}
              at <span className="font-semibold">{event.event_name}</span>
            </>
          ) : null}
        </p>
        {tier === "winner" ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
            <Trophy className="h-4 w-4" />
            {prizeDescription || "Prize winner"}
          </p>
        ) : tier === "finalist" ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
            <Award className="h-4 w-4" />
            Finalist — advanced to the final round
          </p>
        ) : null}
        <p className="mt-6 text-sm text-neutral-500">
          {issueDate
            ? issueDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : null}
          {issueDate && event?.location ? " · " : null}
          {event?.location}
        </p>
        <p className="mt-10 text-xs text-neutral-400">
          Issued by MentorMates · Verify at {certUrl.replace(/^https?:\/\//, "")}
        </p>
      </div>

      <Card className="no-print mt-8">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:flex-wrap sm:items-center">
          <Button onClick={() => window.print()} variant="default" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button onClick={handleAddToLinkedIn} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add to LinkedIn profile
          </Button>
          <Button
            onClick={() => handleShareCert("linkedin")}
            variant="outline"
            size="sm"
          >
            Share on LinkedIn
          </Button>
          <Button
            onClick={() => handleShareCert("twitter")}
            variant="outline"
            size="sm"
          >
            Share on X
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(certUrl);
              toast({
                title: "Link copied!",
                description: "Certificate link copied to clipboard",
              });
            }}
            variant="outline"
            size="sm"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy certificate link
          </Button>
        </CardContent>
      </Card>

      {teamMembers.length > 1 && (
        <p className="no-print mt-4 text-sm text-muted-foreground">
          Teammates: open this page while signed in to get your own
          certificate and share link.
        </p>
      )}

      <div className="no-print mt-6">
        <Link
          href={`/projects/public/${projectId}`}
          className="text-sm underline underline-offset-4"
        >
          ← Back to project
        </Link>
      </div>
      <Toaster />
    </div>
  );
}
