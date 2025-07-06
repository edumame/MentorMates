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

  const layoutConfig = isAcceptPage
    ? {
        showNavbar: false,
        showPadding: false,
        showEventHeader: false,
        showEventWrapper: false,
        showFooter: false,
      }
    : {
        showNavbar: true,
        showPadding: true,
        showEventHeader: true,
        showEventWrapper: true,
        showFooter: true,
      };

  return (
    <LayoutConfigProvider config={layoutConfig}>
      {children}
    </LayoutConfigProvider>
  );
}