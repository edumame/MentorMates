"use client";

import Link from "next/link";
import { Award, Link as LinkIcon } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

export interface ProjectShareSectionProps {
  projectId: string;
  projectName: string;
  eventName?: string | null;
  teamNames?: string[];
  videoUrl?: string | null;
  /** Show the certificate link (submitted projects only) */
  showCertificateLink?: boolean;
}

/** Public share URL for a project — always the public route so recipients can open it logged-out. */
export function publicProjectUrl(projectId: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.mentormates.ai";
  return `${origin}/projects/public/${projectId}`;
}

/** Pre-drafted caption used for LinkedIn / X / WhatsApp shares. */
export function buildShareCaption(opts: {
  projectName: string;
  eventName?: string | null;
  teamNames?: string[];
  videoUrl?: string | null;
  url: string;
}): string {
  const { projectName, eventName, teamNames, videoUrl, url } = opts;
  const team =
    teamNames && teamNames.length > 1 ? " with my amazing team" : "";
  const lines = [
    `Just built ${projectName}${eventName ? ` at ${eventName}` : ""}${team} 🚀`,
    "Shout out to @MentorMates",
    "#AI #Hackathon #BuildInPublic",
  ];
  if (videoUrl) lines.push(`🎥 Watch the demo: ${videoUrl}`);
  lines.push(url);
  return lines.join("\n");
}

/**
 * Shared "Share this project" section used by both the public and private
 * project detail routes (route parity — see CLAUDE.md).
 */
export function ProjectShareSection({
  projectId,
  projectName,
  eventName,
  teamNames,
  videoUrl,
  showCertificateLink,
}: ProjectShareSectionProps) {
  
  const handleShare = (platform: string) => {
    const url = publicProjectUrl(projectId);
    const caption = buildShareCaption({
      projectName,
      eventName,
      teamNames,
      videoUrl,
      url,
    });

    switch (platform) {
      case "copy":
        navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "Project link copied to clipboard",
        });
        break;
      case "linkedin":
        // LinkedIn's official share endpoint doesn't accept prefilled text, and this
        // unofficial feed composer link isn't guaranteed to keep working — copy the
        // caption so it's ready to paste either way.
        navigator.clipboard.writeText(caption);
        toast({
          title: "Caption copied!",
          description: "Paste it into your LinkedIn post if it isn't prefilled.",
        });
        window.open(
          `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`,
          "_blank",
        );
        break;
      case "twitter":
        window.open(
          `https://x.com/intent/tweet?text=${encodeURIComponent(caption)}`,
          "_blank",
        );
        break;
      case "facebook":
        // Facebook's sharer no longer honors a prefilled quote/caption — copy it so
        // it's ready to paste into the post.
        navigator.clipboard.writeText(caption);
        toast({
          title: "Caption copied!",
          description: "Facebook won't prefill it — paste it into your post.",
        });
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
        );
        break;
      case "whatsapp":
        window.open(
          `https://wa.me/?text=${encodeURIComponent(caption)}`,
          "_blank",
        );
        break;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-black tracking-tight">
        Share this project
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleShare("copy")}
          aria-label="Copy project link"
          className="bg-white flex items-center justify-center p-2.5 min-h-11 min-w-11 rounded-full"
        >
          <LinkIcon className="h-5 w-5" />
        </button>

        {/* LinkedIn */}
        <button
          onClick={() => handleShare("linkedin")}
          aria-label="Share on LinkedIn"
          className="bg-white flex items-center justify-center p-2.5 min-h-11 min-w-11 rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 18 18"
            fill="none"
          >
            <path
              clipRule="evenodd"
              d="M1.5 0C0.67157 0 0 0.67157 0 1.5V16.5C0 17.3284 0.67157 18 1.5 18H16.5C17.3284 18 18 17.3284 18 16.5V1.5C18 0.67157 17.3284 0 16.5 0H1.5ZM5.52076 4.00272C5.52639 4.95897 4.81061 5.54819 3.96123 5.54397C3.16107 5.53975 2.46357 4.90272 2.46779 4.00413C2.47201 3.15897 3.13998 2.47975 4.00764 2.49944C4.88795 2.51913 5.52639 3.1646 5.52076 4.00272ZM9.2797 6.76176H6.75971H6.7583V15.3216H9.4217V15.1219C9.4217 14.742 9.4214 14.362 9.4211 13.9819C9.4203 12.9681 9.4194 11.9532 9.4246 10.9397C9.426 10.6936 9.4372 10.4377 9.5005 10.2028C9.7381 9.3253 10.5271 8.7586 11.4074 8.8979C11.9727 8.9864 12.3467 9.3141 12.5042 9.8471C12.6013 10.1803 12.6449 10.5389 12.6491 10.8863C12.6605 11.9339 12.6589 12.9815 12.6573 14.0292C12.6567 14.399 12.6561 14.769 12.6561 15.1388V15.3202H15.328V15.1149C15.328 14.6629 15.3278 14.211 15.3275 13.7591C15.327 12.6296 15.3264 11.5001 15.3294 10.3702C15.3308 9.8597 15.276 9.3563 15.1508 8.8627C14.9638 8.1286 14.5771 7.5211 13.9485 7.0824C13.5027 6.77019 13.0133 6.5691 12.4663 6.5466C12.404 6.54401 12.3412 6.54062 12.2781 6.53721C11.9984 6.52209 11.7141 6.50673 11.4467 6.56066C10.6817 6.71394 10.0096 7.0641 9.5019 7.6814C9.4429 7.7522 9.3852 7.8241 9.2991 7.9314L9.2797 7.9557V6.76176ZM2.68164 15.3244H5.33242V6.76733H2.68164V15.3244Z"
              fill="black"
            />
          </svg>
        </button>

        {/* X / Twitter */}
        <button
          onClick={() => handleShare("twitter")}
          aria-label="Share on X"
          className="bg-white flex items-center justify-center p-2.5 min-h-11 min-w-11 rounded-full"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>

        {/* Facebook */}
        <button
          onClick={() => handleShare("facebook")}
          aria-label="Share on Facebook"
          className="bg-white flex items-center justify-center p-2.5 min-h-11 min-w-11 rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M22 12.3033C22 6.7467 17.5229 2.24219 12 2.24219C6.47715 2.24219 2 6.7467 2 12.3033C2 17.325 5.65684 21.4874 10.4375 22.2422V15.2116H7.89844V12.3033H10.4375V10.0867C10.4375 7.56515 11.9305 6.17231 14.2146 6.17231C15.3088 6.17231 16.4531 6.36882 16.4531 6.36882V8.8448H15.1922C13.95 8.8448 13.5625 9.62041 13.5625 10.4161V12.3033H16.3359L15.8926 15.2116H13.5625V22.2422C18.3432 21.4874 22 17.3252 22 12.3033Z"
              fill="black"
            />
          </svg>
        </button>

        {/* WhatsApp */}
        <button
          onClick={() => handleShare("whatsapp")}
          aria-label="Share on WhatsApp"
          className="bg-white flex items-center justify-center p-2.5 min-h-11 min-w-11 rounded-full"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </button>
      </div>

      {showCertificateLink && (
        <Link
          href={`/certificate/${projectId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-black underline underline-offset-4 hover:opacity-70"
        >
          <Award className="h-4 w-4" />
          View certificate
        </Link>
      )}
    </div>
  );
}
