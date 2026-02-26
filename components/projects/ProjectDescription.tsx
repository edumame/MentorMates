import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { cn } from "@/lib/utils";

interface ProjectDescriptionProps {
  value: string;
  variant?: "header" | "body";
  truncateLines?: number;
  className?: string;
}

export function ProjectDescription({
  value,
  variant = "body",
  truncateLines,
  className,
}: ProjectDescriptionProps) {
  if (!value?.trim()) {
    return null;
  }

  const clampStyle =
    typeof truncateLines === "number"
      ? {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical" as const,
          WebkitLineClamp: truncateLines,
          overflow: "hidden",
        }
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
    <div className={containerClassName} style={clampStyle}>
      <div className={proseClassName}>
        <ReactMarkdown
          rehypePlugins={markdownRehypePlugins}
          components={customMarkdownComponents}
        >
          {value}
        </ReactMarkdown>
      </div>
    </div>
  );
}
