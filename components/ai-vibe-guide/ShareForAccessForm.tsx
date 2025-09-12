"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

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
        <section
            className="
                mx-auto w-full max-w-5xl
                flex flex-col items-center
                gap-12 md:gap-12
                px-4 sm:px-6
                py-8 md:py-16
            "
        >
        <Card className="w-full rounded-2xl border border-gray-200 shadow-sm">
            <CardContent className="p-5 sm:p-6 md:p-8">
            {/* Header */}
            <div className="mb-4 sm:mb-5">
                <p className="text-5xl mb-2">🥰</p>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold leading-tight">
                    Unlock the Appendix for Free
                </h3>
            </div>

            {/* Divider */}
            <hr className="border-t border-gray-200 mb-4 sm:mb-6" />

            {/* Intro copy */}
            <p className="text-md sm:text-sm text-gray-900 mb-4 sm:mb-5">
                You can still access the appendix without paying by helping us
                spread the word:
            </p>

            {/* Checklist */}
            <div className="space-y-3 mb-6 sm:mb-8">
                <ChecklistItem>1. Share this guide on LinkedIn</ChecklistItem>
                <ChecklistItem>
                2. Tag Chinat Yu in your post
                </ChecklistItem>
                <ChecklistItem>3. Drop your LinkedIn post URL below</ChecklistItem>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-5" aria-live="polite">
                <Field
                    id="email"
                    label="Your email"
                    type="email"
                    value={email}
                    onChange={(v) => setEmail(v)}
                    placeholder="you@example.com"
                />

                <Field
                    id="linkedin"
                    label="LinkedIn Post URL"
                    type="url"
                    value={linkedinUrl}
                    onChange={(v) => setLinkedinUrl(v)}
                    placeholder="https://www.linkedin.com/posts/..."
                />

                <Button
                    type="submit"
                    variant="default"
                    disabled={status === "loading"}
                    className="
                        w-full h-11 sm:h-12 rounded-xl text-white font-medium
                        hover:bg-blue-600
                        disabled:opacity-60 disabled:cursor-not-allowed
                    "
                >
                {status === "loading" ? "Submitting..." : "Unlock now"}
                </Button>

                {status === "success" && (
                <p className="text-green-700 text-sm">
                    Thanks! We&apos;ll verify your post and give you full access to
                    the guide—including the appendix.
                </p>
                )}
                {status === "error" && error && (
                <p className="text-red-700 text-sm">{error}</p>
                )}
            </form>

            </CardContent>
        </Card>
        </section>
    );
}


function ChecklistItem({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
        <Check className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 mr-2 flex-shrink-0 text-gray-700" />
        <span className="text-md text-gray-900 sm:text-sm">{children}</span>
        </div>
    );
}

function Field(props: {
    id: string;
    label: string;
    type: "email" | "url" | "text";
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    }) {
    return (
        <div>
        <label
            htmlFor={props.id}
            className="block text-md sm:text-sm text-gray-900 mb-1"
        >
            {props.label}
        </label>
        <input
            id={props.id}
            type={props.type}
            required
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            className="
            w-full h-11 sm:h-12 rounded-xl
            border border-gray-300
            px-3 text-[13px] sm:text-sm placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            bg-white
            "
        />
        </div>
    );
}
