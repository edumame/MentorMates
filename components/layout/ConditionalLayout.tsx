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
    <div className="min-h-screen flex flex-col">
      {/* Add top padding only when needed */}
      <div className={`flex flex-1 ${shouldPad ? "pt-[calc(var(--banner-h,0px)+64px)]" : ""}`}>
        <main className="flex-1 flex flex-col">
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
