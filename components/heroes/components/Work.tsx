"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";

export function Work() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // keep the line full-height (we still drive it with motion for smooth rendering)
    const lineHeight = useTransform(scrollYProgress, [0, 1], ["100%", "100%"]);

    const steps = [
        {
        id: "01",
        title: "Learn",
        description:
            "Browse 20+ events tailored for you. Find your next challenge and register in just a few clicks.",
        image: "/img/join.png",
        side: "left" as const, // text on left, image on right
        },
        {
        id: "02",
        title: "Create",
        description:
            "Use our expertly curated resources to guide your team from ideation to a winning solution, so you can focus on building what matters.",
        image: "/img/create.png",
        side: "right" as const, // image on left, text on right
        },
        {
        id: "03",
        title: "Grow",
        description:
            "Receive constructive feedback from 100+ industry leaders to iterate on your ideas and achieve the best possible results.",
        image: "/img/feedback.png",
        side: "left" as const, // text on left, image on right
        },
    ];

    return (
        <section
        ref={containerRef}
        className="w-full py-16 sm:py-20 rounded-t-[56px] sm:rounded-t-[80px] lg:rounded-t-[112px]"
        style={{
            background:
            "linear-gradient(180deg, rgba(229,240,254,0.65) 0%, rgba(229,240,254,0.42) 96.63%)",
        }}
        >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
            {/* Header */}
            <header className="text-center mb-14 sm:mb-16">
            <h2 className="text-[28px] sm:text-[34px] lg:text-[36px] leading-tight font-semibold text-gray-900">
                How MentorMates Works
            </h2>
            <p className="mt-3 text-[13px] sm:text-sm text-gray-500">
                Streamline your hackathon experience with a platform that guides you through every step
            </p>
            </header>

            {/* Timeline */}
            <div className="relative">
            {/* center line desktop */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-px bg-[#D5E1F5]/80 h-full">
                <motion.div className="w-px bg-[#4B89EF]" style={{ height: lineHeight }} />
            </div>
            {/* left line mobile */}
            <div className="md:hidden absolute left-6 w-px bg-[#D5E1F5]/80 h-full">
                <motion.div className="w-px bg-[#4B89EF]" style={{ height: lineHeight }} />
            </div>

            <div className="space-y-24 md:space-y-28">
                {steps.map((s, i) => {
                const textLeft = s.side === "left";
                return (
                    <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="relative grid md:grid-cols-2 gap-8 md:gap-12 items-center"
                    >
                    {/* marker dot on the line */}
                    <span
                        aria-hidden
                        className="hidden md:block absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#4B89EF] shadow-[0_0_0_4px_rgba(75,137,239,0.15)]"
                    />
                    <span
                        aria-hidden
                        className="md:hidden absolute left-6 -translate-x-1/2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#4B89EF] shadow-[0_0_0_4px_rgba(75,137,239,0.15)]"
                    />

                    {/* text block */}
                    <div className={textLeft ? "order-1 text-right md:pr-12" : "order-2 md:pl-12"}>
                        <div className={textLeft ? "md:ml-auto max-w-[420px]" : "max-w-[420px]"}>
                        <span className="block text-[11px] tracking-[0.14em] text-gray-900/80 mb-1">
                            {s.id}
                        </span>
                        <h3 className="text-[24px] sm:text-[28px] font-semibold text-gray-900">
                            {s.title}
                        </h3>
                        <p className="mt-4 text-[13px] leading-6 text-gray-600">{s.description}</p>
                        </div>
                    </div>

                    {/* image block */}
                    <div className={textLeft ? "order-2" : "order-1"}>
                        <div
                        className={`bg-white rounded-2xl md:rounded-3xl shadow-[0_8px_24px_rgba(22,34,66,0.08)] overflow-hidden ${
                            textLeft ? "" : "md:ml-auto"
                        } max-w-[520px]`}
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
                    </motion.div>
                );
                })}
            </div>
            </div>
        </div>
        </section>
    );
}
