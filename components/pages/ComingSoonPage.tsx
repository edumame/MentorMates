"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

export default function ComingSoonPage() {
    // Rotating words (mirrors LandingHero behavior)
    const titles = useMemo(
        () => ["Hackathons", "Projects", "Prototypes", "Builders"],
        []
    );
    const [titleIndex, setTitleIndex] = useState(0);
    const longestTitle = useMemo(
        () => titles.reduce((a, b) => (b.length > a.length ? b : a), ""),
        [titles]
    );

    // Small-screen motion tuning (same idea as LandingHero)
    const [isSmall, setIsSmall] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)");
        const set = () => setIsSmall(mq.matches);
        set();
        mq.addEventListener?.("change", set);
        return () => mq.removeEventListener?.("change", set);
    }, []);

    useEffect(() => {
        const id = setTimeout(
        () => setTitleIndex((i) => (i === titles.length - 1 ? 0 : i + 1)),
        2000
        );
        return () => clearTimeout(id);
    }, [titleIndex, titles]);

    const ENTER_Y = isSmall ? -40 : -100;
    const EXIT_Y_UP = isSmall ? -60 : -150;
    const EXIT_Y_DOWN = isSmall ? 60 : 150;

    return (
        <div className="relative min-h-screen bg-white flex flex-col pt-16">

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center">
            <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
            {/* Icon in a soft ring, matching your blue palette */}
            <div className="flex justify-center mb-8">
                <div className="p-4 rounded-full bg-blue-50 ring-1 ring-blue-100">
                <Clock className="h-12 w-12 text-blue-600" aria-hidden="true" />
                </div>
            </div>

            {/* Headline with animated rotating word */}
            <h1 className="text-gray-900 font-semibold text-5xl sm:text-6xl md:text-6xl lg:text-[72px] tracking-[-0.06em] leading-[1.1]">
                Coming soon for{" "}
                <span className="relative inline-block align-baseline w-full">
                <span className="relative flex justify-center overflow-hidden w-full h-full py-1 sm:py-0">
                    {titles.map((word, idx) => (
                    <motion.span
                        key={idx}
                        className="absolute font-bold leading-[1.1] left-0 top-0 w-full h-full will-change-transform"
                        initial={{ opacity: 0, y: ENTER_Y }}
                        animate={
                        titleIndex === idx
                            ? { y: 0, opacity: 1 }
                            : {
                                y: titleIndex > idx ? EXIT_Y_UP : EXIT_Y_DOWN,
                                opacity: 0,
                            }
                        }
                        transition={{ type: "spring", stiffness: 50 }}
                        style={{
                        background:
                            "linear-gradient(90deg, #DBEAFE 0%, #4286F4 48%, #1C64F2 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        }}
                    >
                        <span className="text-5xl sm:text-6xl md:text-6xl lg:text-[72px] leading-[1.1]">
                        {word}
                        </span>
                    </motion.span>
                    ))}
                    {/* Spacer keeps container height/width steady */}
                    <span className="invisible font-bold text-5xl sm:text-6xl md:text-6xl lg:text-[72px] leading-[1.1]">
                    {longestTitle}
                    </span>
                </span>
                </span>
            </h1>

            {/* Supporting copy */}
            <p className="mt-6 text-lg text-gray-600">
                We&apos;re building something that helps students focus on what matters
                most — creating impactful projects. Stay tuned!
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                    Back to Home
                </Button>
                </Link>

                <Link href="/login" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Get updates
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
                </Link>
            </div>

            </div>
        </main>

        <Footer />
        </div>
    );
}