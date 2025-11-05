"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";

interface RouteBasedLayoutConfigProps {
  children: ReactNode;
}

export function RouteBasedLayoutConfig({ children }: RouteBasedLayoutConfigProps) {
  const pathname = usePathname();
  const isAcceptPage = pathname?.includes('/accept');
  let layoutConfig;

  if (isAcceptPage) {
    layoutConfig = {
      showNavbar: false,
      showPadding: false,
      showEventHeader: false,
      showEventWrapper: false,
      showFooter: false,
    };
  } else {
    //all pages should use the same layout. We are no longer using the old EventHeader.
    layoutConfig = {
      showNavbar: true,
      showPadding: false,
      showEventHeader: false,
      showEventWrapper: false,
      showFooter: true,
    };
  }

  return (
    <LayoutConfigProvider config={layoutConfig}>
      {children}
    </LayoutConfigProvider>
  );
}