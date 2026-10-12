"use client";

import React from "react";
import { getEmbedDescriptor, safeVideoUrl } from "./video-url";

interface VideoEmbedProps {
  url: string;
  title?: string;
  className?: string;
  /**
   * When true (default), renders an "Open video" fallback link for URLs we
   * can't embed. Set to false to preserve legacy `null` behavior.
   */
  fallback?: boolean;
  /** Fired when the iframe or direct `<video>` fails to load (expired embed, network error, etc.). */
  onLoadError?: () => void;
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  url,
  title = "Video",
  className = "",
  fallback = true,
  onLoadError,
}) => {
  const descriptor = getEmbedDescriptor(url);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  React.useEffect(() => {
    const frame = iframeRef.current;
    const handleError = () => onLoadError?.();
    frame?.addEventListener("error", handleError);
    return () => frame?.removeEventListener("error", handleError);
  }, [url, onLoadError]);

  if (!descriptor) {
    if (!fallback || !safeVideoUrl(url)) return null;
    return (
      <div className={`w-full ${className}`}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#D7DEEB] bg-white px-3 py-2 text-sm font-medium text-[#2E68CA] hover:border-[#AEB8CF]"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden shadow-md bg-black">
        {descriptor.kind === "iframe" ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin allow-presentation allow-scripts"
            src={descriptor.src}
            loading="lazy"
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : (
          <video
            src={descriptor.src}
            controls
            preload="metadata"
            playsInline
            className="absolute top-0 left-0 w-full h-full"
            title={title}
            onError={() => {
              onLoadError?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
