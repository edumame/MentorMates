"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";

interface ServerRouteBasedLayoutConfigProps {
  children: ReactNode;
}

export function ServerRouteBasedLayoutConfig({ 
  children,
}: ServerRouteBasedLayoutConfigProps) {
  const pathname = usePathname();
  
  // Memoize the config to prevent unnecessary re-renders
  const layoutConfig = useMemo(() => {
    // During SSR or if pathname is not available, use default config
    if (!pathname) {
      return {
        showNavbar: true,
        showPadding: false,
        showEventHeader: false,
        showEventWrapper: false,
        showFooter: true,
      };
    }

    const isAcceptPage = pathname.includes('/accept');
    
    if (isAcceptPage) {
      return {
        showNavbar: false,
        showPadding: false,
        showEventHeader: false,
        showEventWrapper: false,
        showFooter: false,
      };
    }
    
    return {
      showNavbar: true,
      showPadding: false,
      showEventHeader: false,
      showEventWrapper: false,
      showFooter: true,
    };
  }, [pathname]);

  return (
    <LayoutConfigProvider config={layoutConfig}>
      {children}
    </LayoutConfigProvider>
  );
}

