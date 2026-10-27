"use client";

import React, { useEffect } from "react";
import { SideNav } from "@/components/heroes/components/SideNav";
import { MobileSidebarHeader } from "@/components/layout/mobile-sidebar-drawer";
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
          className="fixed inset-0 flex min-h-0 h-[100dvh] max-h-[100dvh] flex-col bg-[#fbfcfe]"
          style={{ minHeight: "100dvh" }}
        >
          <MobileSidebarHeader showLogoInSidebar={showLogoInSidebar} />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Desktop Sidebar - 灰底铺满到底部，与右侧白底同高 */}
            <aside
              className="fixed bottom-0 left-0 top-0 z-10 hidden w-[var(--sidebar-width,280px)] overflow-y-auto bg-[#fbfcfe] lg:block"
              style={{ minHeight: "100dvh", height: "100dvh" }}
            >
              <SideNav showLogoAtTop={showLogoInSidebar} />
            </aside>

            {/* 右侧区域：桌面距屏幕顶部 16px 外边距；移动端在顶栏下方铺满 */}
            <div
              className="relative z-20 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white lg:ml-[var(--sidebar-width,280px)] lg:mt-4 lg:rounded-tl-[32px] lg:border-t lg:border-l lg:border-[var(--Color-Neutral-Lighter,#D8D8D8)]"
            >
              <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-16px)] lg:min-h-[calc(100dvh-16px)]">
                <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto overscroll-y-contain pt-0">
                  {children}
                </main>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">{children}</div>
      )}
    </>
  );
}
