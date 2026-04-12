"use client";

import { ReactNode } from "react";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
      <div className="flex flex-1 min-w-0 w-full">
        <main className="flex-1 flex flex-col min-w-0 w-full">
          <div className="flex-1 min-w-0 w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
