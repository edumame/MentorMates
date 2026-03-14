"use client";

import React, { useEffect } from "react";
import { SideNav } from "@/components/heroes/components/SideNav";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

interface SidebarLayoutProps {
  children: React.ReactNode;
  /** When true, show logo at top of SideNav (e.g. event pages with no top header) */
  showLogoInSidebar?: boolean;
}

export function SidebarLayout({ children, showLogoInSidebar }: SidebarLayoutProps) {
  const { isAuthenticated } = useAuth();

  // 事件页等使用侧栏时把 body 设为白底，避免底部露出灰/背景色
  useEffect(() => {
    if (!isAuthenticated || !showLogoInSidebar) return;
    const prev = document.body.style.background;
    document.body.style.background = "#fff";
    return () => {
      document.body.style.background = prev;
    };
  }, [isAuthenticated, showLogoInSidebar]);

  return (
    <>
      {isAuthenticated ? (
        <div
          className="fixed inset-0 flex min-h-screen h-screen bg-[#fbfcfe]"
          style={{ minHeight: "100dvh", height: "100dvh" }}
        >
            {/* Desktop Sidebar - 灰底铺满到底部，与右侧白底同高 */}
            <aside
              className="hidden lg:block bg-[#fbfcfe] flex-shrink-0 fixed left-0 top-0 bottom-0 w-[var(--sidebar-width,280px)] overflow-y-auto z-10 min-h-screen"
              style={{ minHeight: "100dvh", height: "100dvh" }}
            >
              <SideNav showLogoAtTop={showLogoInSidebar} />
            </aside>

            {/* 右侧区域：距屏幕顶部 16px 外边距，上/左边框用设计变量，左上圆角贴底 */}
            <div
              className="relative z-20 flex-1 min-w-0 mt-4 lg:ml-[var(--sidebar-width,280px)] flex flex-col bg-white rounded-tl-[32px] overflow-hidden"
              style={{
                height: "calc(100dvh - 16px)",
                minHeight: "calc(100dvh - 16px)",
                borderTop: "1px solid var(--Color-Neutral-Lighter, #D8D8D8)",
                borderLeft: "1px solid var(--Color-Neutral-Lighter, #D8D8D8)",
              }}
            >
              <main className="flex-1 flex flex-col min-h-0 overflow-auto pt-0">
                {children}
              </main>
            </div>
        </div>
      ) : (
        <div className="h-full w-full overflow-auto">{children}</div>
      )}
    </>
  );
}
