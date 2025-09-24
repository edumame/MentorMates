"use client";
import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { StickyBanner } from "@/components/ui/sticky-banner";

export function AnnouncementBanner() {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <StickyBanner 
            className="fixed inset-x-0 top-0 z-[60]"
            style={{
                background: 'linear-gradient(to right, #C375FE, #5EC7FC)'
            }}
        >
            <div className="flex items-center w-full max-w-7xl mx-auto px-2 py-2 relative">
                <p className="text-center text-white drop-shadow-md text-sm sm:text-[15px] flex-1">
                    We just launched the AI Vibe Guide —{" "}
                    <Link href="/ai-vibe-guide" className="underline font-medium ml-1 hover:text-gray-200">
                    Check it Out.
                    </Link>
                </p>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-white hover:text-gray-200 transition-colors p-1 absolute right-4"
                    aria-label="Close announcement"
                >
                    <X size={24} />
                </button>
            </div>
        </StickyBanner>
    );
}
