import React from 'react';

// Custom link component that opens in new tab
const CustomLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const { href, children, className = '', ...restProps } = props;
  
  // Handle cases where href might be undefined or empty
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 hover:text-blue-800 underline transition-colors duration-200 ${className}`}
      {...restProps}
    >
      {children}
    </a>
  );
};

// Safe responsive iframe renderer
const SafeIframe: React.FC<React.IframeHTMLAttributes<HTMLIFrameElement>> = (props) => {
  const { src, allow, allowFullScreen, className = '', ...rest } = props;

  if (!src) return null;

  // Basic allowlist: only permit https and specific providers (YouTube/Vimeo) by default
  const isAllowedSrc = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com)\//i.test(src) ||
    /^https:\/\/www\.youtube-nocookie\.com\//i.test(src) ||
    /^https:\/\/www\.youtube\.com\/embed\//i.test(src);

  if (!isAllowedSrc) return null;

  return (
    <div className={`relative w-full overflow-hidden rounded-lg my-4 ${className}`} style={{ paddingTop: '56.25%' }}>
      <iframe
        src={src}
        title="Embedded content"
        className="absolute left-0 top-0 h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow={allow ?? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'}
        allowFullScreen={allowFullScreen ?? true}
        {...rest}
      />
    </div>
  );
};

// Export custom components object for ReactMarkdown
export const customMarkdownComponents = {
  a: CustomLink,
  iframe: SafeIframe,
};