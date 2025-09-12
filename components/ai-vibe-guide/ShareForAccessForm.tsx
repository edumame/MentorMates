"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Status = "idle" | "loading" | "success" | "error";

export function ShareForAccessForm() {
    const [email, setEmail] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus("loading");
        setError(null);
        try {
        const res = await fetch("/api/guide/free-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, linkedinUrl }),
        });
        if (!res.ok) throw new Error("Failed to submit");
        setStatus("success");
        } catch {
        setError("Please check your email and LinkedIn URL and try again.");
        setStatus("error");
        }
    }

    return (
        <Card className="mt-6">
        <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">Unlock the Appendix for Free</h3>
            <p className="text-sm text-gray-600 mb-3">
            You can still access the appendix without paying by helping us spread the word:
            </p>
            <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1 mb-4">
            <li>Share this guide on LinkedIn</li>
            <li>
                Tag <strong>Chinat Yu</strong> in your post
            </li>
            <li>Drop your LinkedIn post URL below</li>
            </ol>

            <form onSubmit={onSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium mb-1">Your Email</label>
                <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="you@example.com"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">LinkedIn Post URL</label>
                <input
                type="url"
                required
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="https://www.linkedin.com/posts/..."
                />
            </div>

            <div className="flex items-center gap-3">
                <Button variant="cta" type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Submitting..." : "Submit for Free Access"}
                </Button>
                <Link
                href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fmentormates.ai%2Fai-vibe-guide"
                target="_blank"
                className="text-blue-600 hover:underline text-sm"
                >
                Open LinkedIn Share
                </Link>
            </div>

            {status === "success" && (
                <p className="text-green-700 text-sm">
                Thanks! We&apos;ll verify your post and give you full access to the guide—including the appendix.
                </p>
            )}
            {status === "error" && error && <p className="text-red-700 text-sm">{error}</p>}
            </form>
        </CardContent>
        </Card>
    );
}
