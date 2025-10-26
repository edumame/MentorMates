"use client";

import { Link as LinkIcon, QrCode, Linkedin, Facebook } from "lucide-react";
import { Resource } from "@/lib/types";

interface EventPageSidebarProps {
  eventResources?: Resource[];
  eventId: string;
  eventSlug?: string;
}

export function EventPageSidebar({
  eventResources,
  eventId,
  eventSlug,
}: EventPageSidebarProps) {
  const eventUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/events/${eventSlug || eventId}/overview`;

  const handleShare = (platform: string) => {
    switch (platform) {
      case "copy":
        navigator.clipboard.writeText(eventUrl);
        alert("Link copied to clipboard!");
        break;
      case "linkedin":
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(eventUrl)}`,
          "_blank"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`,
          "_blank"
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(eventUrl)}`,
          "_blank"
        );
        break;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full md:w-[341px] px-2 md:px-4">
      {/* Important Links */}
      {eventResources && eventResources.length > 0 && (
        <div className="flex flex-col gap-4 w-full">
          <h3 className="font-semibold text-[22px] leading-[1.4] text-black text-center md:text-left tracking-[-0.06em]">
            Important links
          </h3>

          <div className="flex flex-col gap-4">
            {eventResources.map((res, idx) => (
              <a
                key={idx}
                href={res.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[rgba(0,0,0,0.05)] flex gap-2 items-center justify-center px-6 py-2.5 rounded-xl shadow-sm relative"
                style={{
                  boxShadow:
                    "0px 0px 0px 1px inset rgba(0,0,0,0.05), 0px -2px 1px 0px inset rgba(0,0,0,0.05)",
                }}
              >
                <p className="font-medium text-base text-black">{res.name}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Divider - only show if important links exist */}
      {eventResources && eventResources.length > 0 && (
        <div className="h-px bg-gray-200 w-full" />
      )}

      {/* Share Section */}
      <div className="flex flex-col gap-4 items-center md:items-start w-full">
        <p className="font-medium text-lg text-black text-center md:text-left tracking-[-0.06em]">
          Share this event
        </p>

        <div className="flex gap-2 items-start">
          {/* Copy Link */}
          <button
            onClick={() => handleShare("copy")}
            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
          >
            <LinkIcon className="w-6 h-6 text-black" />
          </button>

          {/* QR Code */}
          <button className="flex flex-col items-center justify-center overflow-hidden p-1 rounded-lg">
            <QrCode className="w-6 h-6 text-black" />
          </button>

          {/* LinkedIn */}
          <button
            onClick={() => handleShare("linkedin")}
            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
          >
            <Linkedin className="w-6 h-6 text-black" />
          </button>

          {/* Twitter/X */}
          <button
            onClick={() => handleShare("twitter")}
            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>

          {/* Facebook */}
          <button
            onClick={() => handleShare("facebook")}
            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
          >
            <Facebook className="w-6 h-6 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
