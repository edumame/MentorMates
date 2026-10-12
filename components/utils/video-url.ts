type EmbedKind = "iframe" | "video";

export interface EmbedDescriptor {
  src: string;
  kind: EmbedKind;
}

export function safeVideoUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}

const DIRECT_VIDEO_REGEX = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;

// Utility function to convert video URLs to embed URLs (iframe src or direct media src).
export const getEmbedDescriptor = (url: string): EmbedDescriptor | null => {
  const parsed = safeVideoUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();

  // YouTube patterns
  const youtubeRegex =
    /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    return {
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      kind: "iframe",
    };
  }

  // Vimeo patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch && ["vimeo.com", "www.vimeo.com"].includes(host)) {
    return {
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      kind: "iframe",
    };
  }

  // Loom patterns
  const loomRegex = /(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9]+)/;
  const loomMatch = url.match(loomRegex);
  if (loomMatch && ["loom.com", "www.loom.com"].includes(host)) {
    return {
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
      kind: "iframe",
    };
  }

  // Restrict iframe destinations to the provider's actual host and path.
  if (
    (host === "player.vimeo.com" && parsed.pathname.startsWith("/video/")) ||
    (["dailymotion.com", "www.dailymotion.com"].includes(host) && parsed.pathname.startsWith("/embed/")) ||
    (["twitch.tv", "www.twitch.tv"].includes(host) && parsed.pathname.startsWith("/videos/")) ||
    (["facebook.com", "www.facebook.com"].includes(host) && parsed.pathname === "/plugins/video.php")
  ) return { src: url, kind: "iframe" };

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
