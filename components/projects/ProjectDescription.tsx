"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { cn } from "@/lib/utils";

interface ProjectDescriptionProps {
  value: string;
  variant?: "header" | "body";
  truncateLines?: number;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
}

export function ProjectDescription({
  value,
  variant = "body",
  truncateLines,
  className,
  expandLabel = "...",
  collapseLabel = "Show less",
}: ProjectDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [truncateLines, value]);

  useEffect(() => {
    if (!contentRef.current || typeof truncateLines !== "number") {
      setIsTruncated(false);
      return;
    }

    const element = contentRef.current;
    const originalStyle = element.style.cssText;

    element.style.removeProperty("display");
    element.style.removeProperty("-webkit-box-orient");
    element.style.removeProperty("-webkit-line-clamp");
    element.style.removeProperty("overflow");
    const fullHeight = element.scrollHeight;

    element.style.setProperty("display", "-webkit-box");
    element.style.setProperty("-webkit-box-orient", "vertical");
    element.style.setProperty("-webkit-line-clamp", String(truncateLines));
    element.style.setProperty("overflow", "hidden");
    const clampedHeight = element.clientHeight;

    element.style.cssText = originalStyle;

    setIsTruncated(fullHeight > clampedHeight + 1);
  }, [truncateLines, value]);

  if (!value?.trim()) {
    return null;
  }

  const clampStyle =
    typeof truncateLines === "number" && !isExpanded
      ? {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical" as const,
          WebkitLineClamp: truncateLines,
          overflow: "hidden",
        } satisfies CSSProperties
      : undefined;

  const proseClassName = cn(
    "prose prose-neutral max-w-none",
    variant === "header"
      ? "prose-p:my-0 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
      : "prose-p:my-3 prose-p:leading-relaxed prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
  );

  const containerClassName = cn(
    variant === "header" ? "text-gray-700" : "text-black",
    className
  );

  return (
    <div className={containerClassName}>
      <div ref={contentRef} className={proseClassName} style={clampStyle}>
        <ReactMarkdown
          rehypePlugins={markdownRehypePlugins}
          components={customMarkdownComponents}
        >
          {value}
        </ReactMarkdown>
      </div>
      {isTruncated && (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            "mt-1 text-sm font-medium transition-colors",
            variant === "header"
              ? "text-gray-500 hover:text-gray-700"
              : "text-gray-600 hover:text-gray-800"
          )}
        >
          {isExpanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}
