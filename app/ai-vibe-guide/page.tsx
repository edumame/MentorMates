"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { SparklesCore } from "@/components/ui/sparkles";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

function ShareForAccessForm() {
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
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
        <h3 className="text-xl font-semibold mb-2">
          Unlock the Appendix for Free
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          You can still access the appendix without paying by helping us spread
          the word:
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              className="w-full rounded-md border px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              LinkedIn Post URL
            </label>
            <input
              type="url"
              required
              value={linkedinUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLinkedinUrl(e.target.value)
              }
              className="w-full rounded-md border px-3 py-2"
              placeholder="https://www.linkedin.com/posts/..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="cta" type="submit" disabled={status === "loading"}>
              {status === "loading"
                ? "Submitting..."
                : "Submit for Free Access"}
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
  );
}

export default function GuideLanding() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <BackgroundBeams className="opacity-50" />
        <SparklesCore
          className="absolute inset-0"
          background="transparent"
          particleDensity={80}
          minSize={1}
          maxSize={3}
          speed={3}
        />
      </div>
      <div className="px-5 py-16 md:py-24">
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

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 mt-14">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold">Access Options</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-2">Instant Access</h2>
              <p className="text-gray-600 mb-4">
                If you pay now, you’ll unlock:
              </p>
              <ul className="text-sm text-gray-700 space-y-2 mb-4 list-disc pl-5">
                <li>All existing preview chapters</li>
                <li>All future updates to those chapters</li>
                <li>Exclusive hands-on appendix guides</li>
              </ul>
              <Link href="/ai-vibe-guide/checkout">
                <Button variant="cta" className="h-10 px-5">
                  Unlock Now - $20
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-2">
                Weekly Free Release
              </h2>
              <p className="text-gray-600 mb-4">
                If you don’t pay right away, you can still get access to new
                content each week:
              </p>
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li>Chapters released weekly in parts</li>
                <li>
                  Hands-on appendix guides (videos + tutorials) remain locked
                </li>
                <li>
                    Subscribe to our{" "}
                    <Link
                      href="https://mentormates.substack.com/"
                      className="inline-flex items-center text-blue-700 hover:underline"
                    >
                      Substack
                    </Link>, where we release new chapters
                    weekly!
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="my-10 text-center text-gray-400">⸻</div>

        <ShareForAccessForm />

        <div className="text-center text-sm text-gray-600">
          <p>
            Prefer to support later? Share on LinkedIn and tag{" "}
            <strong>Chinat Yu</strong> to get it free.
          </p>
        </div>
      </div>

      <CTAJoin />
      <Footer />
    </section>
  );
}
