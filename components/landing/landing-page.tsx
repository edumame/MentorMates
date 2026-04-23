"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PlayCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoCarousel } from "@/components/heroes/components/LogoCarousel";
import { Customer } from "@/components/heroes/components/Customer";
import { CTAJoin } from "@/components/layout/CTAJoin";

function ProductPill({ children }: { children: string }) {
  return (
    <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-100">
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
}

function LandingHero() {
  return (
    <div className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 pt-24 pb-12 sm:pt-28 sm:pb-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-4xl sm:text-5xl md:text-6xl font-semibold tracking-[-0.06em] text-black">
            Host High-Signal Hackathons{" "}
            <span className="text-blue-600">That Sponsors Love</span>
          </h1>
          <p className="mt-4 text-pretty text-sm sm:text-base text-zinc-600">
            Give every student a 24/7 world-class pitch coach. Turn raw ideas into
            high-signal projects that attract top-tier judges, mentors, and sponsors.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" className="gap-2 rounded-full">
              <PlayCircle className="h-4 w-4" />
              Demo
            </Button>
            <Link href="/events/new">
              <Button className="gap-2 rounded-full">
                Host your event free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Product preview */}
        <div className="mt-10 sm:mt-12">
          <div className="mx-auto max-w-5xl rounded-2xl border border-black/10 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] overflow-hidden">
            <Image
              src="/landing/product-preview-placeholder.svg"
              alt="MentorMates product preview"
              width={1600}
              height={1000}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: "Define & Deploy",
      description:
        "Create your event and align the AI Coach with sponsor themes or company OKRs.",
      bullets: ["Custom AI agents", "Instant infrastructure"],
    },
    {
      title: "Scale Your Mentorship",
      description:
        "Manage registrations through your portal while the AI handles real-time feedback for every team.",
      bullets: ["Automated guidance", "Mentor + judge workflows"],
    },
  ] as const;

  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
        <div className="text-center">
          <ProductPill>Product</ProductPill>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.06em] text-black">
            Features &amp; Benefits
          </h2>
        </div>

        <div className="mt-12 grid gap-10 lg:gap-14">
          {features.map((f, idx) => (
            <div
              key={f.title}
              className={cn(
                "grid items-center gap-8 lg:grid-cols-12",
                idx % 2 === 1 && "lg:[&>div:first-child]:order-2"
              )}
            >
              <div className="lg:col-span-6">
                <h3 className="text-3xl font-semibold tracking-[-0.04em] text-black">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm sm:text-base text-zinc-600 max-w-xl">
                  {f.description}
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                  {f.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="text-sm font-medium text-zinc-900">{b}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Button variant="secondary" className="rounded-full">
                    Book a demo
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-blue-50 ring-1 ring-blue-100 p-6 sm:p-10">
                  <div className="mx-auto aspect-[4/3] w-full max-w-md rounded-2xl bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-24 w-24 rounded-2xl bg-blue-600/10 ring-1 ring-blue-600/15 flex items-center justify-center">
                        <Image
                          src="/mentormate.png"
                          alt="MentorMates"
                          width={44}
                          height={44}
                        />
                      </div>
                      <div className="h-24 w-24 rounded-2xl bg-zinc-100 ring-1 ring-black/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  const steps = [
    "Create your event",
    "Invite your community",
    "Watch the magic",
  ] as const;

  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.06em] text-black">
              From Idea to Demo Day in 3 Steps
            </h2>
            <div className="mt-6 space-y-4">
              {steps.map((s) => (
                <div key={s} className="flex items-center gap-3 text-zinc-800">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <span className="text-sm sm:text-base">{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link href="/events/new">
                <Button className="rounded-full">Host your first event free</Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 bg-zinc-50 border-b border-black/10 flex items-center justify-between">
                <div className="font-semibold">MentorMates</div>
                <div className="h-8 w-8 rounded-full bg-zinc-200" />
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-white ring-1 ring-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="bg-white">
      <LandingHero />
      <LogoCarousel />
      <FeaturesSection />
      <Customer />
      <StepsSection />
      <CTAJoin />
    </div>
  );
}

