"use client";

import { AccessOptionCard } from "./AccessOptionCard";

export function AccessOptions() {
    return (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-8 md:pt-16">
        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Instant access
        </h2>

        <div className="mt-6 sm:mt-10 flex justify-center">
            <div className="w-full max-w-md">
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
            </div>
        </div>
        </section>
    );
}
