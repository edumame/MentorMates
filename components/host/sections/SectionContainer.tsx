import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionContainerProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function SectionContainer({
  children,
  className,
  innerClassName,
}: SectionContainerProps) {
  return (
    <section className={cn("bg-white", className)}>
      <div
        className={cn(
          "mx-auto w-full max-w-host px-4 sm:px-6 md:px-10 lg:px-16 py-12 sm:py-16 md:py-20 lg:py-28",
          innerClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
