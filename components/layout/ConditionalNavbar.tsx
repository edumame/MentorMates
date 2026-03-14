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

  // 2) 与 Manage Event 一致：这些路由用左侧 SideNav + 右侧内容区，顶栏不显示，logo 在侧栏顶部
  const sidebarOnlyRoutes = ["/", "/learn", "/projects", "/feedback", "/agents"];
  const isSidebarOnlyRoute =
    pathname === "/" ||
    pathname?.startsWith("/events") ||
    sidebarOnlyRoutes.some((r) => r !== "/" && pathname?.startsWith(r));
  if (isSidebarOnlyRoute) {
    return null;
  }

  // 3) Other early returns
  if (isAuthRoute || !showNavbar) {
    return null;
  }

  // While resolving session, render nothing to avoid flash (or swap this for a skeleton if you prefer)
  if (isLoading) return null;

  return session ? <AuthNavbar /> : <Navbar />;
}
