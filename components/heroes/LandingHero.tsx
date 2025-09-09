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
import { LogoCarousel } from "./components/LogoCarousel";

export function LandingHero() {
  // Rotating word animation
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
                  {/* Spacer to preserve layout height */}
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
      <CTA />
    </div>
  );
}
