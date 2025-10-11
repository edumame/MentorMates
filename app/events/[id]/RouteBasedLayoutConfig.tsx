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
  const isOverviewPage = pathname?.includes('/overview');

  let layoutConfig;

  if (isAcceptPage) {
    layoutConfig = {
      showNavbar: false,
      showPadding: false,
      showEventHeader: false,
      showEventWrapper: false,
      showFooter: false,
    };
  } else if (isOverviewPage) {
    // Hide the old EventHeader for overview page since we have the new EventPageHeader
    layoutConfig = {
      showNavbar: true,
      showPadding: false,
      showEventHeader: false,
      showEventWrapper: false,
      showFooter: true,
    };
  } else {
    layoutConfig = {
      showNavbar: true,
      showPadding: true,
      showEventHeader: true,
      showEventWrapper: true,
      showFooter: true,
    };
  }

  return (
    <LayoutConfigProvider config={layoutConfig}>
      {children}
    </LayoutConfigProvider>
  );
}