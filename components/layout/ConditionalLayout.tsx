"use client";

import { ReactNode } from "react";
import { useLayoutConfig } from "./LayoutConfigProvider";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { showPadding } = useLayoutConfig();

  if (!showPadding) {
    // No padding layout
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex flex-1">
          <main className="flex-1 flex flex-col">
            <div className="flex-1">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Standard layout with navbar padding
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1 pt-16">
        <main className="flex-1 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}