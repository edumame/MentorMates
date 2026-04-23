"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLayoutConfig } from "./LayoutConfigProvider";

interface ConditionalLayoutProps {
  children: ReactNode;
}

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { showPadding } = useLayoutConfig();
  const pathname = usePathname();

  const isAuthRoute =
    !!pathname &&
    AUTH_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  // Only pad for navbar when not on auth routes
  const shouldPad = showPadding && !isAuthRoute;

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Add top padding only when needed */}
      <div className={`flex flex-1 min-w-0 w-full ${shouldPad ? "pt-16" : ""}`}>
        <main className="flex-1 flex flex-col min-w-0 w-full">
          <div className="flex-1 min-w-0 w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
