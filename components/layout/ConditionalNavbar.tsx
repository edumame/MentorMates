"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { useLayoutConfig } from "./LayoutConfigProvider";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];

export function ConditionalNavbar() {
  const pathname = usePathname();
  const { showNavbar } = useLayoutConfig();
  const { session, isLoading } = useAuth();

  const isAuthRoute =
    !!pathname &&
    AUTH_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  if (isAuthRoute || !showNavbar) return null;
  if (isLoading) return null;
  if (!session) return <Navbar />;
  return null;
}
