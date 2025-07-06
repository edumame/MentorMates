"use client";

import { createContext, useContext, ReactNode } from "react";

interface LayoutConfig {
  showNavbar: boolean;
  showPadding: boolean;
  showEventHeader: boolean;
  showEventWrapper: boolean;
  showFooter: boolean;
}

const defaultConfig: LayoutConfig = {
  showNavbar: true,
  showPadding: true,
  showEventHeader: true,
  showEventWrapper: true,
  showFooter: true,
};

const LayoutConfigContext = createContext<LayoutConfig>(defaultConfig);

interface LayoutConfigProviderProps {
  children: ReactNode;
  config?: Partial<LayoutConfig>;
}

export function LayoutConfigProvider({ children, config = {} }: LayoutConfigProviderProps) {
  const mergedConfig = { ...defaultConfig, ...config };

  return (
    <LayoutConfigContext.Provider value={mergedConfig}>
      {children}
    </LayoutConfigContext.Provider>
  );
}

export function useLayoutConfig() {
  return useContext(LayoutConfigContext);
}