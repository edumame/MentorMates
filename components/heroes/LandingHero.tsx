"use client";

import Link from "next/link";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Work } from "@/components/heroes/components/Work";
import { Featured } from "@/components/heroes/components/Featured";
import { Impact } from "@/components/heroes/components/Impact";
import { Customer } from "@/components/heroes/components/Customer";
import { CTA } from "@/components/heroes/components/CTA";

export function LandingHero() {
  const logos = [
    {
      alt: "Tencent",
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Tencent_Logo.svg/2560px-Tencent_Logo.svg.png",
    },
    {
      alt: "Goodnotes",
      src: "https://seeklogo.com/images/G/goodnotes-logo-9E1E6A4FAD-seeklogo.com.png",
    },
    {
      alt: "Inspirit AI",
      src: "https://uploads-ssl.webflow.com/5cd8ca5d0f14f8fe27ad10d4/62323f0b7397d3d3b6e0d3fa_inspirit-logo.png",
    },
    {
      alt: "Johns Hopkins University",
      src: "https://upload.wikimedia.org/wikipedia/commons/5/5d/Johns_Hopkins_University_logo.svg",
    },
    {
      alt: "Microsoft",
      src: "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg",
    },
    {
      alt: "PayPal",
      src: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Paypal_2014_logo.png",
    },
    {
      alt: "U.S. Bank",
      src: "https://upload.wikimedia.org/wikipedia/commons/4/49/US_Bank_logo.svg",
    },
    {
      alt: "Google",
      src: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    },
    {
      alt: "Amazon",
      src: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    },
  ];

  return (
    <div className="relative overflow-hidden bg-white">
      {/* --- HERO --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-start">
          {/* Left: Huge headline */}
          <div className="lg:col-span-7">
            <h1 className="leading-[0.95] tracking-tight text-gray-900 font-extrabold text-5xl sm:text-6xl lg:text-[72px]">
              <span className="block">Your home for</span>
              <span className="mt-5 relative inline-block">
                {/* <span className="slope-highlight" aria-hidden="true" /> */}
                <TextGenerateEffect 
                  words="Hackathons" 
                  className="relative"
                />
              </span>
            </h1>
          </div>

          {/* Right: Copy + CTA */}
          <div className="lg:col-span-5 lg:pl-6">
            <p className="text-base sm:text-md lg:text-md text-gray-700 leading-relaxed">
              MentorMates guides you through your entire hackathon journey.
              Built by students, for students, our platform helps you focus on
              what matters most — creating an impactful project.
            </p>

            <div className="mt-6">
              <Link href="/login" className="inline-block">
                <Button className="inline-flex items-center rounded-xl px-6 py-3 text-base font-medium text-white bg-[#4B89EF] hover:bg-[#4B89EF] transition-colors">
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* --- TRUSTED BY + LOGO RAIL --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <p className="text-center text-sm sm:text-base text-gray-700">
          Trusted by top companies and innovative organizations
        </p>

        <div className="relative mt-6">
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent" />

          {/* Scrollable rail with gentle auto-marquee */}
          <div className="group overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max gap-10 py-4 will-change-transform animate-marquee group-hover:[animation-play-state:paused]">
              {[...logos, ...logos].map((l, i) => (
                <div
                  key={`${l.alt}-${i}`}
                  className="flex items-center justify-center h-14 min-w-[160px] opacity-80 hover:opacity-100 transition-opacity"
                  aria-hidden={i >= logos.length ? true : undefined}
                >
                  {/* use <img> to avoid next/image domain config for external hosts */}
                  <img
                    src={l.src}
                    alt={l.alt}
                    className="max-h-10 object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Work />
      <Featured />
      <Impact />
      <Customer />
      <CTA />

      {/* logo animation */}
      <style jsx>{`
        /* Slanted "slope" highlight behind the word Hackathons */
        .slope-highlight {
          position: absolute;
          inset: 0 -6px -6px -10px;
          background: linear-gradient(
            90deg,
            rgba(59, 130, 246, 0.18),
            rgba(59, 130, 246, 0.28)
          );
          transform: skewX(-12deg) translateY(6px);
          border-radius: 12px;
          filter: blur(0.2px);
          animation: floaty 4s ease-in-out infinite;
        }
        @keyframes floaty {
          0% {
            transform: skewX(-12deg) translateY(6px);
          }
          50% {
            transform: skewX(-12deg) translateY(10px);
          }
          100% {
            transform: skewX(-12deg) translateY(6px);
          }
        }

        /* Infinite marquee for logos (pauses on hover) */
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .slope-highlight,
          .animate-marquee {
            animation: none !important;
          }
        }

        /* Hide scrollbars cross-browser (container still scrolls on trackpads/drags) */
        .group::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
