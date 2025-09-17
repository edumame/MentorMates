"use client";

import React from "react";
import { LogoMarquee, type LogoItem } from "@/components/ui/LogoMarquee";

export const logos: LogoItem[] = [
    { alt: "Tencent", src: "/partners/tencent.png" },
    { alt: "Goodnotes", src: "/partners/goodnotes.png" },
    { alt: "Inspirit AI", src: "/partners/inspirit.png" },
    { alt: "Johns Hopkins University", src: "/partners/jhu.png" },
    { alt: "Stanford", src: "/partners/stanford.png" },
    { alt: "HKPU", src: "/partners/hkpu.png" },
];

type LogoCarouselProps = {
    items?: LogoItem[];
    itemHeightClass?: string;
    className?: string;
    speed?: number;
    speedMobile?: number;
    reverse?: boolean;
    fade?: boolean;
    pauseOnHover?: boolean;
};

export function LogoCarousel({
    items,
    itemHeightClass = "h-6 sm:h-8 lg:h-10",
    className = "h-10 sm:h-12 lg:h-16 w-full max-w-full",
    speed = 24,
    speedMobile = 20,
    reverse = false,
    fade = true,
    pauseOnHover = true,
    }: LogoCarouselProps) {
    return (
        <section
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 lg:py-12 overflow-hidden"
        style={{ overflowX: "clip" }}
        >
        {/* keep horizontal overflow clipped globally without touching vertical scroll */}
        <style jsx global>{`
            :where(html, body, #__next) { overflow-x: clip; }
        `}</style>

        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-700 mb-6 sm:mb-8">
            Trusted by top companies and innovative organizations
        </p>

        {/* 
            -mx-* cancels section padding to avoid edge artifacts causing overflow.
            IMPORTANT: no `contain: size` here—only `layout paint`.
            The min-h matches the logo heights so the wrapper never collapses even if inner tracks are absolute.
        */}
        <div
            className="-mx-4 sm:-mx-6 lg:-mx-10 overflow-x-hidden"
            style={{ overflowX: "clip", contain: "layout paint", isolation: "isolate" }}
        >
            <div
            className="w-[100vw] max-w-[100vw] min-w-0 overflow-x-hidden min-h-10 sm:min-h-12 lg:min-h-16"
            style={{ overflowX: "clip" }}
            >
            <LogoMarquee
                logos={items ?? logos}
                itemHeightClass={itemHeightClass}
                className={className}
                speed={speed}
                speedMobile={speedMobile}
                reverse={reverse}
                fade={fade}
                pauseOnHover={pauseOnHover}
            />
            </div>
        </div>
        </section>
    );
}
