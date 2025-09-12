"use client";

import { AccessOptionCard } from "./AccessOptionCard";

export function AccessOptions() {
    return (
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 mt-14">
        <div className="md:col-span-2">
            <h2 className="text-2xl font-bold">Access Options</h2>
        </div>

        <AccessOptionCard
            title="Instant Access (Recommended)"
            description="If you pay now, you'll unlock:"
            points={[
            "All existing preview chapters",
            "All future updates to those chapters",
            "Exclusive hands-on appendix guides",
            ]}
            cta={{ href: "/ai-vibe-guide/checkout", label: "Unlock Now - $20" }}
        />

        <AccessOptionCard
            title="Weekly Free Release"
            description="If you don't pay right away, you can still get access to new content each week:"
            points={[
            "Chapters released weekly in parts",
            "Hands-on appendix guides (videos + tutorials) remain locked",
            ]}
        />
        </div>
    );
}
