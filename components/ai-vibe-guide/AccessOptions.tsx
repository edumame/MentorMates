"use client";

import { AccessOptionCard } from "./AccessOptionCard";

export function AccessOptions() {
    return (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-8 md:pt-16">
        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Access option
        </h2>

        <div className="mt-6 sm:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <AccessOptionCard
                title="Instant Access"
                price="$20"
                points={[
                    "All existing preview chapters",
                    "All future updates to those chapters",
                    "Exclusive hands-on appendix guides",
                ]}
                cta={{ href: "/ai-vibe-guide/checkout", label: "Unlock now" }}
            />

            <AccessOptionCard
                title="Weekly Release"
                price="Starting in November"
                points={[
                    "Chapters released weekly in parts",
                    "Hands-on appendix guides (videos + tutorials) remain locked",
                    "Subscribe to our Substack, where we release new chapters weekly starting in November!",
                ]}
                cta={{ href: "https://mentormates.substack.com/", label: "Subscribe to our Substack" }}
            />
        </div>
        </section>
    );
}
