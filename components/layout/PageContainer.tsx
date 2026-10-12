import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  showBorder?: boolean;
  className?: string;
}

/**
 * PageContainer - Shared layout component with consistent border styling
 *
 * This component provides the consistent top-left border and rounded corner
 * that appears across all authenticated pages (home, events, projects, learn, feedback).
 *
 * The border stays fixed in place while content scrolls inside.
 */
export function PageContainer({
  children,
  showBorder = true,
  className = ""
}: PageContainerProps) {
  return (
    <div
      className={`${
        showBorder
          ? "h-[calc(100vh-88px)] overflow-hidden md:h-auto md:flex-1 md:min-h-0"
          : "min-h-[calc(100vh-64px)]"
      } flex min-w-0 flex-col ${
        showBorder ? "md:rounded-tl-2xl md:border-t md:border-l md:border-[#D8D8D8]" : ""
      } bg-white ${className}`}
    >
      {children}
    </div>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageContent - Scrollable content area inside PageContainer
 *
 * Use this as a direct child of PageContainer to create a scrollable content area.
 */
export function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <div className={`min-h-0 flex-grow overflow-auto border-0 ${className}`}>
      {children}
    </div>
  );
}
