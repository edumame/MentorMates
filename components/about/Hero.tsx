"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Hero() {
    return (
        <div className="bg-white py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
                    <div className="space-y-4">
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                            Bridging GenAI and pedagogy
                        </h1>
                    </div>

                    <div className="space-y-8">
                        <p className="text-base sm:text-md leading-relaxed max-w-lg">
                            We research how generative AI can provide personalized, meaningful feedback. Our goal is to develop solutions that help students grow in hackathons and project-based learning without losing the impact of human mentorship.
                        </p>

                        <Button asChild variant="default" className="rounded-xl px-4 py-2 text-sm sm:text-base hover:bg-[#4B89EF]/90">
                            <Link href="/research" aria-label="See our research">
                                See our research
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
