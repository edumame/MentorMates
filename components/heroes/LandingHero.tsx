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
import { CTAJoin } from "@/components/layout/CTAJoin";
import { LogoCarousel } from "./components/LogoCarousel";

export function LandingHero() {
  const [titleIndex, setTitleIndex] = useState(0);
  const titles = useMemo(
    () => [
      "Hackathons",
      "AI Workshops",
      "Demo Days",
      "Pitch Days",
      "Prototypes",
      "Builders",
    ],
    []
  );

  const longestTitle = useMemo(
    () => titles.reduce((a, b) => (b.length > a.length ? b : a), ""),
    [titles]
  );

  // detect small screens to adjust animation distances
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const set = () => setIsSmall(mq.matches);
    set();
    mq.addEventListener?.("change", set);
    return () => mq.removeEventListener?.("change", set);
  }, []);

  useEffect(() => {
    const id = setTimeout(
      () => setTitleIndex((i) => (i === titles.length - 1 ? 0 : i + 1)),
      2000
    );
    return () => clearTimeout(id);
  }, [titleIndex, titles]);

  // responsive translate distances to avoid clipping
  const ENTER_Y = isSmall ? -40 : -100;
  const EXIT_Y_UP = isSmall ? -60 : -150;
  const EXIT_Y_DOWN = isSmall ? 60 : 150;

  return (
    <div className="relative bg-white overflow-x-hidden">
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 pt-24 sm:pt-20 lg:pt-24 pb-8 sm:pb-16 lg:pb-20">
        <div className="grid lg:grid-cols-12 gap-2 items-start">
          {/* Left: Huge headline */}
          <div className="lg:col-span-7 min-w-0">
            <h1 className="text-gray-900 font-semibold text-5xl sm:text-6xl md:text-6xl lg:text-[72px] font-geist tracking-[-0.06em] leading-[1.1]">
              <span>
                Your home for{" "}
                <span className="relative inline-block align-baseline w-full">
                  <span className="relative flex justify-start overflow-hidden w-full h-full py-1 sm:py-0">
                    {titles.map((word, idx) => (
                      <motion.span
                        key={idx}
                        className="absolute font-bold leading-[1.1] left-0 top-0 w-full h-full will-change-transform"
                        initial={{ opacity: 0, y: ENTER_Y }}
                        animate={
                          titleIndex === idx
                            ? { y: 0, opacity: 1 }
                            : {
                                y:
                                  titleIndex > idx ? EXIT_Y_UP : EXIT_Y_DOWN,
                                opacity: 0,
                              }
                        }
                        transition={{ type: "spring", stiffness: 50 }}
                        style={{
                          background:
                            "linear-gradient(90deg, #DBEAFE 0%, #4286F4 48%, #1C64F2 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          color: "transparent",
                        }}
                      >
                        <span className="text-5xl sm:text-6xl md:text-6xl lg:text-[72px] leading-[1.1]">
                          {word}
                        </span>
                      </motion.span>
                    ))}

                    {/* Spacer: use the LONGEST title to set width (and height) */}
                    <span className="invisible font-bold text-5xl sm:text-6xl md:text-6xl lg:text-[72px] leading-[1.1]">
                      {longestTitle}
                    </span>
                  </span>
                </span>
              </span>
            </h1>
          </div>

          {/* Right: Copy + CTA */}
          <div className="lg:col-span-5 mt-4 lg:mt-0">
            <p className="text-base sm:text-[16px] lg:text-18px] leading-relaxed">
              MentorMates guides you through your entire hackathon journey. Built
              by builders, for builders, our platform helps you focus on what
              matters most — creating an impactful project.
            </p>

            <div className="mt-6 sm:mt-8">
              <Link href="/login" className="inline-block w-full sm:w-auto">
                <Button variant="default">
                  Get started
                  <ArrowRight
                    className="ml-2 h-4 w-4 sm:h-5 sm:w-5"
                    aria-hidden="true"
                  />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <LogoCarousel />
      <Work />
      <Featured />
      <Impact />
      <Build />
      <Customer />
      <CTAJoin />
    </div>
  );
}

