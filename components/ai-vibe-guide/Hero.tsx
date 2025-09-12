"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

export function Hero() {
    return (
        <div className="max-w-5xl mx-auto text-center">
        <TextGenerateEffect
            words="2025 Ultimate AI Vibe Coding Guide"
            className="text-4xl md:text-6xl font-extrabold tracking-tight"
        />
        <p className="text-gray-700 mt-4 md:text-lg max-w-3xl mx-auto">
            A practical, weekly-released playbook for building with AI in 2025.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/ai-vibe-guide/checkout">
            <Button variant="cta" className="h-11 px-6 text-base">
                Get Instant Access - $20
            </Button>
            </Link>
            <Link
            href="/ai-vibe-guide/preview"
            className="inline-flex items-center text-blue-700 hover:underline"
            >
            Read Preview Chapter
            </Link>
        </div>
        </div>
    );
}
