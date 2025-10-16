"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { EventRole } from "@/lib/types";

interface ActiveRoleContextType {
  activeRole: EventRole | null;
  setActiveRole: (role: EventRole) => void;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | undefined>(
  undefined
);

export function ActiveRoleProvider({
  children,
  initialRole,
}: {
  children: ReactNode;
  initialRole: EventRole | null;
}) {
  const [activeRole, setActiveRole] = useState<EventRole | null>(initialRole);

  return (
    <ActiveRoleContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (context === undefined) {
    throw new Error("useActiveRole must be used within an ActiveRoleProvider");
  }
  return context;
}
