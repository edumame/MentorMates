"use client";

import { usePathname } from "next/navigation";
import { AuthNavbar } from "./AuthNavbar";
import { Navbar } from "./Navbar";
import { useLayoutConfig } from "./LayoutConfigProvider";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];

export function ConditionalNavbar() {
  const pathname = usePathname();
  const { showNavbar } = useLayoutConfig();
  const { session, isLoading } = useAuth();

  // 1) Check if on auth routes
  const isAuthRoute =
    !pathname
      ? false
      : AUTH_ROUTE_PREFIXES.some((p) =>
          pathname === p || pathname.startsWith(`${p}/`)
        );

  // 2) Early returns after all hooks are called
  if (isAuthRoute || !showNavbar) {
    return null;
  }

  // While resolving session, render nothing to avoid flash (or swap this for a skeleton if you prefer)
  if (isLoading) return null;

  return session ? <AuthNavbar /> : <Navbar />;
}
