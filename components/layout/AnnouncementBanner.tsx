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
            <div className="flex items-center w-full max-w-7xl mx-auto px-4 sm:px-2 py-2 relative">
                <p className="text-center text-white drop-shadow-md text-sm sm:text-[15px] flex-1 pr-8 sm:pr-12">
                    {/* Previous announcement: */}
                    <span className="block sm:inline">We just launched the AI Vibe Guide 📘 —{" "}</span>
                    <Link href="/ai-vibe-guide" className="underline font-medium hover:text-gray-200 whitespace-nowrap">
                        Check it out
                    </Link>

                    {/* Replaced bounty announcement (commented out) */}
                    {/**
                    <span className="block sm:inline">Check out our AI agent bounty program 🤖 —{" "}</span>
                    <Link
                        href="https://docs.google.com/document/d/1BWgz7OZ046o60Swv_p9bvPi57yrqt19om_kcpinv_Ao/edit?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium hover:text-gray-200 whitespace-nowrap"
                    >
                        Learn more
                    </Link>
                    */}
                </p>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-white hover:text-gray-200 transition-colors p-1 absolute right-2 sm:right-4 flex-shrink-0"
                    aria-label="Close announcement"
                >
                    <X size={20} className="sm:w-6 sm:h-6" />
                </button>
            </div>
        </StickyBanner>
    );
}
