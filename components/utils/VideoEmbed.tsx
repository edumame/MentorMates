import React from "react";

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

type EmbedKind = "iframe" | "video";

export interface EmbedDescriptor {
  src: string;
  kind: EmbedKind;
}

const DIRECT_VIDEO_REGEX = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;

// Utility function to convert video URLs to embed URLs (iframe src or direct media src).
export const getEmbedDescriptor = (url: string): EmbedDescriptor | null => {
  if (!url) return null;

  // YouTube patterns
  const youtubeRegex =
    /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return {
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      kind: "iframe",
    };
  }

  // Vimeo patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return {
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      kind: "iframe",
    };
  }

  // Loom patterns
  const loomRegex = /(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9]+)/;
  const loomMatch = url.match(loomRegex);
  if (loomMatch) {
    return {
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
      kind: "iframe",
    };
  }

  // Already an embed URL
  if (
    url.includes("youtube.com/embed/") ||
    url.includes("player.vimeo.com/video/") ||
    url.includes("loom.com/embed/") ||
    url.includes("dailymotion.com/embed/") ||
    url.includes("twitch.tv/videos/") ||
    url.includes("facebook.com/plugins/video.php")
  ) {
    return { src: url, kind: "iframe" };
  }

  // Direct video files (mp4/webm/mov/m4v/ogg)
  if (DIRECT_VIDEO_REGEX.test(url)) {
    return { src: url, kind: "video" };
  }

  return null;
};

// Backwards-compatible helper that returns only the iframe src (null for non-iframe).
export const getEmbedUrl = (url: string): string | null => {
  const descriptor = getEmbedDescriptor(url);
  if (!descriptor) return null;
  // Preserve prior contract: return an iframe src string (null for non-iframe descriptors).
  return descriptor.kind === "iframe" ? descriptor.src : null;
};

// Utility function to check if a URL can be embedded
export const canEmbed = (url: string): boolean => {
  return getEmbedDescriptor(url) !== null;
};

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  url,
  title = "Video",
  className = "",
  fallback = true,
  onLoadError,
}) => {
  const descriptor = getEmbedDescriptor(url);

  if (!descriptor) {
    if (!fallback || !url) return null;
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
            sandbox="allow-same-origin allow-presentation allow-scripts"
            src={descriptor.src}
            loading="lazy"
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
            onError={() => {
              onLoadError?.();
            }}
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
