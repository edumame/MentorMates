"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get role from query param or use initial role
  const roleFromQuery = searchParams.get("view") as EventRole | null;
  const [activeRole, setActiveRoleState] = useState<EventRole | null>(
    roleFromQuery || initialRole
  );

  // Update URL when active role changes
  const setActiveRole = (role: EventRole) => {
    setActiveRoleState(role);

    // Update URL query param
    const params = new URLSearchParams(searchParams);
    params.set("view", role);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync state with query param changes
  useEffect(() => {
    if (roleFromQuery && roleFromQuery !== activeRole) {
      setActiveRoleState(roleFromQuery);
    }
  }, [roleFromQuery, activeRole]);

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
