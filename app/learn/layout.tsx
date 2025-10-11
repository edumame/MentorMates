import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

export default function LearnLayout({
    children,
    }: {
    children: React.ReactNode;
    }) {
    return (
        <div className="min-h-screen">
        <AuthNavbar />
        <SidebarLayout>{children}</SidebarLayout>
        </div>
    );
}
