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
      <div className="flex flex-col gap-4 items-center w-full">
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
            {/* <Linkedin className="w-6 h-6 text-black" /> */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 18 18" fill="none">
              <path d="M1.5 0C0.67157 0 0 0.67157 0 1.5V16.5C0 17.3284 0.67157 18 1.5 18H16.5C17.3284 18 18 17.3284 18 16.5V1.5C18 0.67157 17.3284 0 16.5 0H1.5ZM5.52076 4.00272C5.52639 4.95897 4.81061 5.54819 3.96123 5.54397C3.16107 5.53975 2.46357 4.90272 2.46779 4.00413C2.47201 3.15897 3.13998 2.47975 4.00764 2.49944C4.88795 2.51913 5.52639 3.1646 5.52076 4.00272ZM9.2797 6.76176H6.75971H6.7583V15.3216H9.4217V15.1219C9.4217 14.742 9.4214 14.362 9.4211 13.9819C9.4203 12.9681 9.4194 11.9532 9.4246 10.9397C9.426 10.6936 9.4372 10.4377 9.5005 10.2028C9.7381 9.3253 10.5271 8.7586 11.4074 8.8979C11.9727 8.9864 12.3467 9.3141 12.5042 9.8471C12.6013 10.1803 12.6449 10.5389 12.6491 10.8863C12.6605 11.9339 12.6589 12.9815 12.6573 14.0292C12.6567 14.399 12.6561 14.769 12.6561 15.1388V15.3202H15.328V15.1149C15.328 14.6629 15.3278 14.211 15.3275 13.7591C15.327 12.6296 15.3264 11.5001 15.3294 10.3702C15.3308 9.8597 15.276 9.3563 15.1508 8.8627C14.9638 8.1286 14.5771 7.5211 13.9485 7.0824C13.5027 6.77019 13.0133 6.5691 12.4663 6.5466C12.404 6.54401 12.3412 6.54062 12.2781 6.53721C11.9984 6.52209 11.7141 6.50673 11.4467 6.56066C10.6817 6.71394 10.0096 7.0641 9.5019 7.6814C9.4429 7.7522 9.3852 7.8241 9.2991 7.9314L9.2797 7.9557V6.76176ZM2.68164 15.3244H5.33242V6.76733H2.68164V15.3244Z" fill="black" />
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
