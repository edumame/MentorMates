"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";

export function ConditionalAnnouncement() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;   // prevent SSR/client mismatch flash
    if (pathname !== "/") return null;

    return <AnnouncementBanner />;
}
