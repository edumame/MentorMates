"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function Hero() {
    return (
        <div className="max-w-3xl mx-auto text-center">
            <Image 
                src="/img/vibeGuide.png" 
                alt="AI Vibe Guide" 
                width={400} height={400} 
                className="mx-auto mb-12 sm:mb-16"
            />
            <h3 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                2025 Ultimate AI Vibe Coding Guide
            </h3>
        <p className="text-gray-700 mt-8 text-sm max-w-3xl mx-auto">
            A practical, weekly-released playbook for building with AI in 2025.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/ai-vibe-guide/checkout">
                <Button variant="default" className="px-4 py-2 text-base">
                    Get Instant Access - $20
                </Button>
            </Link>
            <Link
                href="/ai-vibe-guide/preview"
                className="inline-flex items-center bg-gray-100 px-4 py-2 rounded-xl hover:bg-gray-200"
            >
                Read Preview Chapter
            </Link>
        </div>
        </div>
    );
}
