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
    className = "h-10 sm:h-12 lg:h-16",
    speed = 24,
    speedMobile = 20,
    reverse = false,
    fade = true,
    pauseOnHover = true,
    }: LogoCarouselProps) {
    return (
        <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 lg:py-12 overflow-hidden">
        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-700 mb-6 sm:mb-8">
            Trusted by top companies and innovative organizations
        </p>

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
        </section>
    );
}
