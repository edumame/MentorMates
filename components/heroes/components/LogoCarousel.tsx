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
    /** Override the default logos if needed */
    items?: LogoItem[];
    /** Height classes for the images (default keeps things mobile-safe) */
    itemHeightClass?: string;
    /** Container className */
    className?: string;
    /** Seconds per loop (desktop) */
    speed?: number;
    /** Seconds per loop (mobile) */
    speedMobile?: number;
    /** Reverse direction */
    reverse?: boolean;
    /** Edge fades / mask gradient */
    fade?: boolean;
    /** Pause on hover */
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
    );
}
