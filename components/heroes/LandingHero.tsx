"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowForward } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Work } from "@/components/heroes/components/Work";
import { Build } from "@/components/heroes/components/Build";
import { Featured } from "@/components/heroes/components/Featured";
import { Impact } from "@/components/heroes/components/Impact";
import { Customer } from "@/components/heroes/components/Customer";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { LogoCarousel } from "./components/LogoCarousel";

export function LandingHero() {
  // Rotating word animation
  const [titleIndex, setTitleIndex] = useState(0);
  const titles = useMemo(
    () => ["Hackathons", "Projects", "Prototypes", "Builders"],
    []
  );

  const longestTitle = useMemo(
    () => titles.reduce((a, b) => (b.length > a.length ? b : a), ""),
    [titles]
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
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 sm:pt-14 lg:pt-24 pb-8 sm:pb-16 lg:pb-20">
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-8 items-start">
          {/* Left: Huge headline */}
          <div className="lg:col-span-7 min-w-0">
            <h1 className="text-gray-900 font-semibold text-3xl sm:text-4xl md:text-5xl lg:text-[72px] font-geist tracking-[-0.06em] leading-[1.1]">
              <span>
                Your home for{" "}
                <span className="relative inline-block align-baseline w-full">
                  <span className="relative flex justify-start overflow-hidden w-full h-full">
                    {titles.map((word, idx) => (
                      <motion.span
                        key={idx}
                        className="absolute font-extrabold leading-[1.1] left-0 top-0"
                        initial={{ opacity: 0, y: -100 }}
                        animate={
                          titleIndex === idx
                            ? { y: 0, opacity: 1 }
                            : { y: titleIndex > idx ? -150 : 150, opacity: 0 }
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
                        <span className="text-3xl sm:text-4xl md:text-5xl lg:text-[72px] leading-[1.1]">
                          {word}
                        </span>
                      </motion.span>
                    ))}

                    {/* Spacer: use the LONGEST title to set width (and height) */}
                    <span className="invisible font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-[72px] leading-[1.1]">
                      {longestTitle}
                    </span>
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
                <Button variant="default">
                  Get started
                  <ArrowForward
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
