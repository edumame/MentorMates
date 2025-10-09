"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLayoutConfig } from "./LayoutConfigProvider";

interface ConditionalLayoutProps {
  children: ReactNode;
}

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];
const HIDE_PADDING_ROUTES = [/^\/events\/[\w-]+\/accept(\/.*)?$/];

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { showPadding } = useLayoutConfig();
  const pathname = usePathname();

  const isAuthRoute =
    !!pathname &&
    AUTH_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  const isNoPadRoute = !!pathname && HIDE_PADDING_ROUTES.some((r) => r.test(pathname));

  // Only pad for navbar when not on auth routes
  const shouldPad = showPadding && !isAuthRoute && !isNoPadRoute;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Add top padding only when needed */}
      <div className={`flex flex-1 ${shouldPad ? "pt-16" : ""}`}>
        <main className="flex-1 flex flex-col">
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
