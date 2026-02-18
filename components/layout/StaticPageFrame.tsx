"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

export function StaticPageFrame({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return children;

  // Match the "Home" authenticated frame (top/left border + rounded corner)
  // without changing page sizing/scroll behavior.
  return (
    <div className="bg-white rounded-none sm:rounded-tl-2xl sm:border-t sm:border-l sm:border-[#D8D8D8]">
      {children}
    </div>
  );
}

