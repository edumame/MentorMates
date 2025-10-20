import { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Optional content displayed to the right of the title (e.g., count badge)
   */
  titleAside?: ReactNode;
  className?: string;
}

/**
 * PageHeader - Consistent page header for authenticated pages.
 *
 * Standardizes title sizing, spacing, and placement of actions.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  titleAside,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`flex items-end justify-between ${className}`}>
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <h1 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
            {title}
          </h1>
          {titleAside}
        </div>
        {subtitle && (
          <p className="text-[14px] leading-[1.5] text-zinc-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
