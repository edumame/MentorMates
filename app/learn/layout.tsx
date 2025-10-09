import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function LearnLayout({
    children,
    }: {
    children: React.ReactNode;
    }) {
    return (
        <div className="min-h-screen">
        <SidebarLayout>{children}</SidebarLayout>
        </div>
    );
}
