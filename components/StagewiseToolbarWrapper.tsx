"use client";

import { usePathname } from "next/navigation";
import { StagewiseToolbar } from "@stagewise/toolbar-next";

interface StagewiseRequest {
  type: string;
  payload: unknown;
}

const stagewiseConfig = {
  plugins: [],
  onRequest: async (request: StagewiseRequest) => {
    return { success: true };
  },
};

export function StagewiseToolbarWrapper() {
  const pathname = usePathname();
  if (process.env.NODE_ENV !== "development") return null;
  // 始终挂载，避免卸载/重挂导致 "A stagewise companion anchor already exists"
  // 事件页用 visibility 隐藏，不遮挡内容
  const hidden = pathname?.startsWith("/events") ?? false;
  return (
    <div style={{ visibility: hidden ? "hidden" : "visible", pointerEvents: hidden ? "none" : "auto" }} aria-hidden={hidden}>
      <StagewiseToolbar config={stagewiseConfig} />
    </div>
  );
}
