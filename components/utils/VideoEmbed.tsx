import React from 'react';
interface VideoEmbedProps {
  url: string;
  title?: string;
  className?: string;
}

// Utility function to convert video URLs to embed URLs
export const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
  
    // YouTube patterns
    const youtubeRegex = /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
  
  // Vimeo patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Loom patterns
  const loomRegex = /(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9]+)/;
  const loomMatch = url.match(loomRegex);
  if (loomMatch) {
    return `https://www.loom.com/embed/${loomMatch[1]}`;
  }
  
    // Already an embed URL
    if (
      url.includes('youtube.com/embed/') || 
      url.includes('player.vimeo.com/video/') ||
      url.includes('loom.com/embed/') ||
      url.includes('dailymotion.com/embed/') ||
      url.includes('twitch.tv/videos/') ||
      url.includes('facebook.com/plugins/video.php')
    ) {
      return url;
    }
  
    return null;
  };
  
  // Utility function to check if a URL can be embedded
  export const canEmbed = (url: string): boolean => {
    return getEmbedUrl(url) !== null;
  }; 

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ 
  url, 
  title = "Video", 
  className = "" 
}) => {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden shadow-md">
        <iframe
          sandbox="allow-same-origin allow-presentation allow-scripts"
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    </div>
  );
}; 
