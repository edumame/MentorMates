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

// Export custom components object for ReactMarkdown
export const customMarkdownComponents = {
  a: CustomLink,
};