"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { useLayoutConfig } from "./LayoutConfigProvider";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];

export function ConditionalNavbar() {
  const pathname = usePathname();
  const { showNavbar } = useLayoutConfig();
  const { isLoading } = useAuth();

  // 首页始终显示顶栏 Navbar（MentorMates logo）；其余页面一律不显示顶栏，由各页 / SideNav 自行布局
  const isHomepage = pathname === "/";
  if (isHomepage) {
    if (isLoading) return null;
    return <Navbar />;
  }

  // 非首页：登录后不显示顶栏（只用 SideNav），未登录也不显示；认证相关路由不显示
  const isAuthRoute =
    !!pathname &&
    AUTH_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  if (isAuthRoute || !showNavbar) return null;
  if (isLoading) return null;
  return null;
}
