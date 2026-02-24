"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LogoCarousel,
  logos as defaultLogoItems,
} from "@/components/heroes/components/LogoCarousel";
import { Customer } from "@/components/heroes/components/Customer";
import { Play } from "lucide-react";
import { FeaturesHeader } from "./sections/FeaturesHeader";
import { DefineDeploySection } from "./sections/DefineDeploySection";
import { ScaleMentorshipSection } from "./sections/ScaleMentorshipSection";
import { IdeaToDemoCta } from "./sections/IdeaToDemoCta";

const DEMO_VIDEO_URL = "https://www.youtube.com/embed/kXwY--1M4jY";

const HOST_LOGOS = [
  ...defaultLogoItems,
  { alt: "a16z", src: "/partners/a16z.svg" },
  { alt: "Lovable", src: "/partners/lovable-gray.svg" },
];

export function Host() {
  return (
    <section className="relative bg-white overflow-hidden">
      {/* Top background pattern from Figma */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 sm:h-48 md:h-56 -z-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(148,163,184,0.16) 0, rgba(148,163,184,0.16) 1px, transparent 1px, transparent 10px)",
        }}
      />
      {/* Hero */}
      <div className="relative px-4 sm:px-6 py-16 sm:py-20 md:py-24 overflow-hidden">
        {/* subtle grid background to match Figma */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              [
                "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px)",
                "linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
              ].join(", "),
            backgroundSize: ["72px 72px", "72px 72px"].join(", "),
            backgroundPosition: "center top",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0) 100%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0) 100%)",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <h1 className="font-geist mx-auto max-w-[931px] text-[32px] sm:text-[40px] md:text-[56px] lg:text-[72px] font-semibold leading-[1.2] tracking-[-0.06em] text-black">
            Host High-Signal Hackathons
            <span className="block">That Sponsors Love</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-gray-700 text-base sm:text-lg max-w-3xl mx-auto">
            Give every student a 24/7 world-class pitch coach. Turn raw ideas
            into high-signal projects that attract top-tier judges, mentors, and
            sponsors.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex min-w-[260px] sm:min-w-0 py-2.5 px-6 justify-center items-center gap-1.5 rounded-xl bg-black/5 border-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05),inset_0_-2px_1px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.05)] hover:bg-black/[0.08]"
                >
                  <Play className="h-4 w-4 shrink-0" />
                  Demo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 border-0 bg-black overflow-hidden rounded-xl [&>button]:text-white [&>button]:right-2 [&>button]:top-2 [&>button]:bg-white/15 [&>button]:hover:bg-white/25">
                <div className="relative aspect-video">
                  <iframe
                    src={DEMO_VIDEO_URL}
                    title="MentorMates Demo"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="default"
              asChild
              className="flex min-w-[260px] sm:min-w-0 items-center justify-center gap-2 py-2.5 px-6 text-[16px] leading-6 font-medium text-white"
            >
              <Link href="/login">Host your event free</Link>
            </Button>
          </div>

          <div className="mt-10 sm:mt-12">
            <div className="relative mx-auto max-w-5xl">
              <div className="flex flex-col items-start p-[3.5px]">
                <Image
                  src="/img/host-hero.png"
                  alt="MentorMates host dashboard preview"
                  width={1280}
                  height={800}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logos directly under hero — full viewport width, horizontally scrolling */}
      <div className="w-full pb-12 sm:pb-14 md:pb-16">
        <LogoCarousel items={HOST_LOGOS} />
      </div>

      <FeaturesHeader />
      <DefineDeploySection />
      <ScaleMentorshipSection />
      <Customer />
      <IdeaToDemoCta />
    </section>
  );
}
