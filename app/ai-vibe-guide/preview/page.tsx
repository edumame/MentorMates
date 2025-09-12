"use client";

import React, { useEffect, useState } from "react";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/** Top reading progress bar */
function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calc = () => {
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", calc);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-40 h-1 bg-gray-100">
      <div
        className="h-full bg-blue-600 transition-[width] duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Bottom sticky CTA (mobile) */
function StickyCTA() {
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/80 backdrop-blur border-t border-gray-200 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <Link href="/ai-vibe-guide/checkout" className="flex-1">
          <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
            Get full access &ndash; $20
          </Button>
        </Link>
        <Link
          href="/ai-vibe-guide"
          className="text-sm text-blue-700 hover:underline whitespace-nowrap"
        >
          Details
        </Link>
      </div>
    </div>
  );
}

export default function GuidePreview() {
  return (
    <section className="min-h-screen flex flex-col">
      <ReadingProgress />

      {/* HERO */}
      <header className="px-5 pt-16 pb-8 md:pt-20 md:pb-10 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
            <span className="inline-flex items-center gap-2">
              <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-gray-200 text-gray-700 text-xs">
                CY
              </span>
              <span>By Chinat Yu</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>Sep 2025</span>
            <span aria-hidden="true">•</span>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
              PREVIEW
            </span>
          </div>

          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight">
            Introduction — Imagine This
          </h1>

          {/* Desktop CTA under title */}
          <div className="hidden md:flex gap-3 mt-6">
            <Link href="/ai-vibe-guide/checkout">
              <Button variant="default">
                Get full access &ndash; $20
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ARTICLE */}
      <main className="px-5 pb-28 md:pb-16">
        <article className="max-w-3xl mx-auto prose prose-gray prose-p:leading-relaxed prose-headings:scroll-mt-24 md:prose-lg">
          <p>
            Imagine you&apos;re walking down the sidewalk, earbuds in, city
            buzzing around you. Out of nowhere, an idea sparks: What if my app
            could do this one extra thing?
          </p>
          <p>
            You don&apos;t wait until you&apos;re back at your desk. You don&apos;t crack open a
            heavy terminal. You just pull out your phone, type the idea into
            your AI coding assistant, and keep walking.
          </p>
          <p>
            By the time you get home, your idea isn&apos;t just an idea anymore—it&apos;s
            alive. A preview clone of your app is waiting, already updated with
            the new feature. You click through it, check the change, and with
            one tap, it&apos;s shipped to the world.
          </p>
          <p>
            <strong>That&apos;s vibe coding.</strong> It&apos;s not about building
            throwaway demos that vanish after the hackathon, or spinning up toy
            apps in the browser that nobody will ever use. It&apos;s about shipping
            real, production-ready features—apps that can grow, scale, and
            actually serve people.
          </p>

          <h2>The Promise</h2>
          <p>With this vibe coding guide:</p>
          <ul>
            <li>You move at the speed of your imagination.</li>
            <li>No more toy projects that never leave your laptop.</li>
            <li>
              No more waiting hours (or days) for a developer or AI agent to get
              back to you.
            </li>
            <li>
              No more stress that your code will break the second it touches
              production.
            </li>
          </ul>
          <p>
            Instead, you use AI to prototype safely in sandboxes, review
            intelligently, and ship confidently. It&apos;s the workflow of the
            future—fast, scalable, and human-guided.
          </p>

          <h2>The Philosophy</h2>
          <p>
            This book isn&apos;t a shopping list of tools. Tools change. Today&apos;s
            shiny assistant might be tomorrow&apos;s dusty relic. What doesn&apos;t
            change is mindset, framework, and flow—the way you think about
            coding with AI.
          </p>
          <p>That&apos;s what vibe coding is all about:</p>
          <ul>
            <li>
              Building in parallel at scale—leveraging Cloud computing to let AI
              experiment safely while you stay in control in sandbox
              playgrounds.
            </li>
            <li>
              Climbing the Five-Stage Vibe Coding Ladder—knowing how to move
              from quick browser prototypes to full production environments
              without getting stuck.
            </li>
            <li>
              Managing the Five-Level Vibe Coding Risk—understanding which
              changes are safe to ship fast, and which ones demand careful human
              review.
            </li>
          </ul>
          <p>
            I&apos;ve been lucky to stand at the frontlines of this shift—working
            with other AI builders in San Francisco and beyond, testing
            workflows, breaking things, and learning the patterns that actually
            hold up.
          </p>
          <p>
            This book is my field guide. It&apos;s not just about coding—it&apos;s about
            creating in the age of AI.
          </p>

          <h2>A Truth to Hold On To</h2>
          <p>AI won&apos;t replace you.</p>
          <p>But the person who learns to work with AI will replace the person who doesn&apos;t.</p>
          <p>
            This book is your guide to becoming that builder and staying on the
            right side of that story.
          </p>

          {/* Inline CTA near the end for desktop */}
          <div className="hidden md:block not-prose mt-10">
            <div className="flex items-center gap-3">
              <Link href="/ai-vibe-guide/checkout">
                <Button variant="default">
                  Get full access &ndash; $20
                </Button>
              </Link>
            </div>
          </div>
        </article>
      </main>

      <StickyCTA />
      <Footer />
    </section>
  );
}
