"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Work } from "@/components/heroes/components/Work";
import { Build } from "@/components/heroes/components/Build";
import { Featured } from "@/components/heroes/components/Featured";
import { Impact } from "@/components/heroes/components/Impact";
import { Customer } from "@/components/heroes/components/Customer";
import { CTA } from "@/components/heroes/components/CTA";

export function LandingHero() {
  // Rotating word animation (unchanged)
  const [titleIndex, setTitleIndex] = useState(0);
  const titles = useMemo(
    () => ["Hackathons", "Projects", "Prototypes", "Builders"],
    []
  );
  useEffect(() => {
    const id = setTimeout(
      () => setTitleIndex((i) => (i === titles.length - 1 ? 0 : i + 1)),
      2000
    );
    return () => clearTimeout(id);
  }, [titleIndex, titles]);

  const logos = [
    { alt: "Tencent", src: "/partners/tencent.png" },
    { alt: "Goodnotes", src: "/partners/goodnotes.png" },
    { alt: "Inspirit AI", src: "/partners/inspirit.png" },
    { alt: "Johns Hopkins University", src: "/partners/jhu.png" },
    { alt: "Stanford", src: "/partners/stanford.png" },
    { alt: "HKPU", src: "/partners/hkpu.png" },
  ];

  return (
    <div className="relative bg-white overflow-x-hidden">
      {/* --- HERO --- */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 sm:pt-14 lg:pt-24 pb-8 sm:pb-16 lg:pb-20">
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-8 items-start">
          {/* Left: Huge headline */}
          <div className="lg:col-span-7 min-w-0">
            <h1 className="leading-tight tracking-tight text-gray-900 font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-[72px]">
              <span className="block">Your home for</span>
              <span className="mt-3 sm:mt-5 p-2 relative inline-block text-[#4B89EF]">
                <span className="relative flex w-full justify-start overflow-hidden md:pb-1">
                  {titles.map((word, idx) => (
                    <motion.span
                      key={idx}
                      className="absolute font-extrabold"
                      initial={{ opacity: 0, y: -100 }}
                      animate={
                        titleIndex === idx
                          ? { y: 0, opacity: 1 }
                          : { y: titleIndex > idx ? -150 : 150, opacity: 0 }
                      }
                      transition={{ type: "spring", stiffness: 50 }}
                      style={{ lineHeight: 1.1 }}
                    >
                      <span className="text-3xl sm:text-4xl md:text-5xl lg:text-[72px]">
                        {word}
                      </span>
                    </motion.span>
                  ))}
                  <span className="invisible text-3xl sm:text-4xl md:text-5xl lg:text-[72px]">
                    {titles[0]}
                  </span>
                </span>
              </span>
            </h1>
          </div>

          {/* Right: Copy + CTA */}
          <div className="lg:col-span-5 lg:pl-6 mt-4 lg:mt-0 min-w-0">
            <p className="text-sm sm:text-base lg:text-md text-gray-700 leading-relaxed">
              MentorMates guides you through your entire hackathon journey.
              Built by students, for students, our platform helps you focus on
              what matters most — creating an impactful project.
            </p>

            <div className="mt-4 sm:mt-6">
              <Link href="/login" className="inline-block w-full sm:w-auto">
                <Button className="inline-flex items-center justify-center w-full sm:w-auto rounded-xl px-6 py-3 text-sm sm:text-base font-medium text-white bg-[#4B89EF] hover:bg-[#4B89EF]/90 transition-colors">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* --- TRUSTED BY + LOGO MARQUEE (no overflow, no lib) --- */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-10 sm:pb-16 lg:pb-20">
        <p className="text-center text-xs sm:text-sm lg:text-base text-gray-700 pb-8">
          Trusted by top companies and innovative organizations
        </p>

        {/* Rail clamps to viewport width and hides overflow */}
        <div
          className="relative mt-4 sm:mt-6 h-10 sm:h-12 lg:h-16 w-full overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          {/* Optional soft edge fades (visual only) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 sm:w-10 lg:w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 sm:w-10 lg:w-16 bg-gradient-to-l from-white to-transparent z-10" />

          {/* Absolute track — transforms never affect layout width */}
          <div className="absolute left-0 top-0 h-full w-[200%] marquee group">
            {/* first half */}
            <ul className="marquee-half left-0">
              {logos.map((l, i) => (
                <li key={`a-${i}`} className="marquee-item">
                  <img
                    src={l.src}
                    alt={l.alt}
                    className="block h-6 sm:h-8 lg:h-10 w-auto object-contain"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
            {/* second half (duplicate) */}
            <ul className="marquee-half left-1/2">
              {logos.map((l, i) => (
                <li key={`b-${i}`} className="marquee-item">
                  <img
                    src={l.src}
                    alt={l.alt}
                    className="block h-6 sm:h-8 lg:h-10 w-auto object-contain"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Work />
      <Featured />
      <Impact />
      <Build />
      <Customer />
      <CTA />

      {/* Scoped styles */}
      <style jsx>{`
        .marquee {
          animation: marquee 24s linear infinite;
        }
        .marquee-half {
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          display: flex;
          align-items: center;
          gap: 1.5rem; /* ~24px; matches sm:gap-6 feel */
          padding-left: 0.25rem;
          padding-right: 0.25rem;
        }
        .marquee-item {
          display: flex;
          align-items: center;
          height: 100%;
          flex: 0 0 auto; /* no shrink */
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @media (max-width: 640px) {
          .marquee {
            animation-duration: 20s;
          }
        }
        /* Accessibility: honor reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .marquee {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
