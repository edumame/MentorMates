"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

export function StaticPageFrame({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const isSupportPage = pathname === "/support";

  if (!isAuthenticated) return children;

  // Match the "Home" authenticated frame (top/left border + rounded corner)
  // without changing page sizing/scroll behavior. Support page: no border.
  return (
    <div
      className={
        isSupportPage
          ? "bg-white"
          : "bg-white rounded-none sm:rounded-tl-2xl sm:border-t sm:border-l sm:border-[#D8D8D8]"
      }
    >
      {children}
    </div>
  );
}

