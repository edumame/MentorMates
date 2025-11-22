"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Work() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const blueHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const lineGradient =
    "linear-gradient(to bottom,var(--brand-primary-hex) 0%,var(--brand-primary-hex) 88%,rgb(var(--brand-primary-rgb) / 0) 100%)";
  const steps = [
    {
      id: "01",
      title: "Learn",
      description:
        "Browse 20+ events tailored for you. Find your next challenge and register in just a few clicks.",
      image: "/img/join.png",
      side: "left" as const,
    },
    {
      id: "02",
      title: "Create",
      description:
        "Use our expertly curated resources to guide your team from ideation to a winning solution, so you can focus on building what matters.",
      image: "/img/create.png",
      side: "right" as const,
    },
    {
      id: "03",
      title: "Grow",
      description:
        "Receive constructive feedback from 100+ industry leaders to iterate on your ideas and achieve the best possible results.",
      image: "/img/feedback.png",
      side: "left" as const,
    },
  ];

  return (
    <section
      ref={containerRef}
      className="w-full py-16 sm:py-20 rounded-[56px] sm:rounded-[80px] lg:rounded-[112px]"
      style={{
        background:
          "linear-gradient(180deg, rgba(229,240,254,0.65) 0%, rgba(229,240,254,0.42) 96.63%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <header className="text-center mb-14 sm:mb-16">
          <h2 className="text-[28px] sm:text-[34px] lg:text-[36px] leading-tight font-semibold text-gray-900 font-geist tracking-[-0.06em]">
            How MentorMates Works
          </h2>
          <p className="mt-3 text-[13px] sm:text-sm text-gray-500">
            Streamline your hackathon experience with a platform that guides you
            through every step
          </p>
        </header>

        {/* Timeline */}
        <div className="relative">
          {/* Center line (desktop) */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 h-full w-px z-0">
              <div className="absolute inset-0 bg-[var(--brand-primary-soft-hex)] opacity-80" />
            <motion.div
              className="absolute top-0 left-0 w-px"
              style={{
                height: blueHeight,
                  background: lineGradient,
              }}
            />
          </div>

          {/* Left line (mobile) */}
          <div className="md:hidden absolute left-6 h-full w-px z-0">
              <div className="absolute inset-0 bg-[var(--brand-primary-soft-hex)] opacity-80" />
            <motion.div
              className="absolute top-0 left-0 w-px"
              style={{
                height: blueHeight,
                  background: lineGradient,
              }}
            />
          </div>

          <div className="space-y-24 md:space-y-28">
            {steps.map((s, i) => {
              const isLeft = s.side === "left";
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="relative px-16 md:px-0 py-16 md:py-0"
                >
                  {/* Marker */}
                  {/* Desktop */}
                  <span
                    aria-hidden
                    className="hidden md:block absolute left-1/2 -translate-x-1/2 top-[10px] w-5 h-5 rounded-full z-10"
                  />
                  <span
                    aria-hidden
                    className="hidden md:block absolute left-1/2 -translate-x-1/2 top-[10px] w-3 h-3 rounded-full bg-[var(--brand-primary-hex)] z-20"
                  />
                  {/* Mobile */}
                  <span
                    aria-hidden
                    className="md:hidden absolute left-6 -translate-x-1/2 top-[10px] w-5 h-5 rounded-full z-10"
                  />
                  <span
                    aria-hidden
                    className="md:hidden absolute left-6 -translate-x-1/2 top-[10px] w-3 h-3 rounded-full bg-[var(--brand-primary-hex)] z-20"
                  />

                  {/* Mobile Layout - Stack ID/Title above description and image */}
                  <div className="md:hidden">
                    {/* ID and Title */}
                    <div className="mb-4">
                      <span className="block text-[20px] tracking-[0.14em]">
                        {s.id}
                      </span>
                      <h3 className="text-[34px] font-semibold text-gray-900 font-geist tracking-[-0.06em]">
                        {s.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="mb-6 text-[16px] leading-6 text-gray-600">
                      {s.description}
                    </p>

                    {/* Image */}
                    <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(22,34,66,0.08)] overflow-hidden max-w-[520px]">
                      <Image
                        src={s.image}
                        alt={s.title}
                        width={1040}
                        height={720}
                        className="w-full h-auto object-cover"
                        priority={i === 0}
                      />
                    </div>
                  </div>

                  {/* Desktop Layout - Two column grid */}
                  <div className="hidden md:grid md:grid-cols-2 gap-12 md:gap-16 items-start">
                    {/* TEXT column (id + title only) — aligns to center line on desktop */}
                    <div
                      className={[
                        isLeft
                          ? "order-1 md:pr-2 md:ml-auto"
                          : "order-2 md:pl-2 md:mr-auto",
                        // desktop: left column text-right, right column text-left
                        isLeft ? "md:text-right" : "md:text-left",
                        "max-w-[520px]",
                      ].join(" ")}
                    >
                      <span className="block text-[20px] tracking-[0.14em]">
                        {s.id}
                      </span>
                      <h3 className="text-[34px] font-semibold text-gray-900 font-geist tracking-[-0.06em]">
                        {s.title}
                      </h3>
                    </div>

                    {/* IMAGE column with description */}
                    <div
                      className={[
                        isLeft ? "order-2" : "order-1",
                        "md:pl-2 md:ml-auto",
                      ].join(" ")}
                    >
                      <p className="mb-6 text-[16px] leading-6 text-gray-600">
                        {s.description}
                      </p>
                      <div
                        className={[
                          "bg-white rounded-2xl md:rounded-3xl shadow-[0_8px_24px_rgba(22,34,66,0.08)] overflow-hidden max-w-[520px]",
                          isLeft ? "" : "md:ml-auto",
                        ].join(" ")}
                      >
                        <Image
                          src={s.image}
                          alt={s.title}
                          width={1040}
                          height={720}
                          className="w-full h-auto object-cover"
                          priority={i === 0}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-center pt-24">
        <h2 className="text-3xl md:text-5xl font-semibold mb-4 md:mb-6 max-w-2xl sm:max-w-3xl mx-auto font-geist tracking-[-0.06em]">
          Join the Innovation Revolution Today
        </h2>

        <p className="text-base sm:text-lg mb-8 px-4 max-w-3xl sm:max-w-4xl mx-auto">
          Become part of a vibrant community of innovators. Together, we can
          create impactful solutions.
        </p>

        <Button variant="default">
          <Link href="/join">Get started</Link>
        </Button>
      </div>
    </section>
  );
}
