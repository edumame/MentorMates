import React from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

export default function LearnLayout({
    children,
    }: {
    children: React.ReactNode;
    }) {
    return (
        <div >
        <AuthNavbar />
        <SidebarLayout>{children}</SidebarLayout>
        </div>
    );
}
