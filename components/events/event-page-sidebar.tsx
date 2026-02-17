"use client";

import { Link as LinkIcon, QrCode } from "lucide-react";
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
    <div className="flex flex-col gap-6 w-full md:w-[341px] md:shrink-0 min-w-0">
      {/* Important Links */}
      {eventResources && eventResources.length > 0 && (
        <div className="flex flex-col gap-4 w-full items-center">
          <h3 className="font-semibold text-[22px] leading-[1.4] text-black text-center md:text-left tracking-[-0.06em]">
            Important links
          </h3>

          <div className="flex flex-col gap-4 w-full">
            {eventResources.map((res, idx) => (
              <a
                key={idx}
                href={res.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[rgba(0,0,0,0.05)] flex gap-2 items-center justify-center px-6 py-2.5 min-h-11 rounded-xl shadow-sm relative w-full"
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
      <div className="flex flex-col gap-4 items-center w-full">
        <p className="font-medium text-[18px] leading-[1.5] text-black text-center tracking-[-0.06em]">
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
            {/* <Linkedin className="w-6 h-6 text-black" /> */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M4.5 3.24219C3.67157 3.24219 3 3.91376 3 4.74219V19.7422C3 20.5706 3.67157 21.2422 4.5 21.2422H19.5C20.3284 21.2422 21 20.5706 21 19.7422V4.74219C21 3.91376 20.3284 3.24219 19.5 3.24219H4.5ZM8.52076 7.24491C8.52639 8.20116 7.81061 8.79038 6.96123 8.78616C6.16107 8.78194 5.46357 8.14491 5.46779 7.24632C5.47201 6.40116 6.13998 5.72194 7.00764 5.74163C7.88795 5.76132 8.52639 6.40679 8.52076 7.24491ZM12.2797 10.0039H9.75971H9.7583V18.5638H12.4217V18.3641C12.4217 17.9842 12.4214 17.6042 12.4211 17.2241C12.4203 16.2103 12.4194 15.1954 12.4246 14.1819C12.426 13.9358 12.4372 13.6799 12.5005 13.445C12.7381 12.5675 13.5271 12.0008 14.4074 12.1401C14.9727 12.2286 15.3467 12.5563 15.5042 13.0893C15.6013 13.4225 15.6449 13.7811 15.6491 14.1285C15.6605 15.1761 15.6589 16.2237 15.6573 17.2714C15.6567 17.6412 15.6561 18.0112 15.6561 18.381V18.5624H18.328V18.3571C18.328 17.9051 18.3278 17.4532 18.3275 17.0013C18.327 15.8718 18.3264 14.7423 18.3294 13.6124C18.3308 13.1019 18.276 12.5985 18.1508 12.1049C17.9638 11.3708 17.5771 10.7633 16.9485 10.3246C16.5027 10.0124 16.0133 9.81129 15.4663 9.78879C15.404 9.7862 15.3412 9.78281 15.2781 9.7794C14.9984 9.76428 14.7141 9.74892 14.4467 9.80285C13.6817 9.95613 13.0096 10.3063 12.5019 10.9236C12.4429 10.9944 12.3852 11.0663 12.2991 11.1736L12.2797 11.1979V10.0039ZM5.68164 18.5666H8.33242V10.0095H5.68164V18.5666Z" fill="black" />
            </svg>
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
            {/* <Facebook className="w-6 h-6 text-black" /> */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22 12.3033C22 6.7467 17.5229 2.24219 12 2.24219C6.47715 2.24219 2 6.7467 2 12.3033C2 17.325 5.65684 21.4874 10.4375 22.2422V15.2116H7.89844V12.3033H10.4375V10.0867C10.4375 7.56515 11.9305 6.17231 14.2146 6.17231C15.3088 6.17231 16.4531 6.36882 16.4531 6.36882V8.8448H15.1922C13.95 8.8448 13.5625 9.62041 13.5625 10.4161V12.3033H16.3359L15.8926 15.2116H13.5625V22.2422C18.3432 21.4874 22 17.3252 22 12.3033Z" fill="black" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
