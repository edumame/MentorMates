"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export function Work() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    // Transform scroll progress to line height
    const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

    const steps = [
        {
            id: "01",
            title: "Learn",
            description: "Browse 20+ events tailored for you. Find your next challenge and register in just a few clicks.",
            image: "/images/login-screen.png",
            position: "left"
        },
        {
            id: "02",
            title: "Create", 
            description: "Use our expertly curated resources to guide your team from ideation to a winning solution, so you can focus on building what matters.",
            image: "/images/create-screen.png",
            position: "right"
        },
        {
            id: "03",
            title: "Grow",
            description: "Receive constructive feedback from 100+ industry leaders to iterate on your ideas and achieve the best possible results.",
            image: "/images/grow-screen.png", 
            position: "left"
        }
    ];

    return (
        <div 
            ref={containerRef}
            className="mx-auto px-4 sm:px-8 lg:px-24 py-12 sm:py-16 rounded-t-[56px] sm:rounded-t-[80px] lg:rounded-t-[112px]"
            style={{
                background: 'linear-gradient(180deg, rgba(229, 240, 254, 0.65) 0%, rgba(229, 240, 254, 0.42) 96.63%)'
            }}
        >
            {/* Header */}
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                    How MentorMates Works
                </h2>
                <p className="text-sm text-gray-500 max-w-2xl mx-auto">
                    Streamline your hackathon experience with a platform that guides you through every step
                </p>
            </div>

            {/* Timeline Container */}
            <div className="relative">
                {/* Animated Center Line - Desktop */}
                <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 bg-gray-300 h-full">
                    <motion.div 
                        className="w-full bg-[#538EF0]"
                        style={{ height: lineHeight }}
                    />
                </div>

                {/* Animated Left Line - Mobile */}
                <div className="md:hidden absolute left-6 w-1 bg-gray-300 h-full">
                    <motion.div 
                        className="w-full bg-[#538EF0]"
                        style={{ height: lineHeight }}
                    />
                </div>

                {/* Steps */}
                <div className="space-y-12 sm:space-y-16 md:space-y-24 px-20">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            viewport={{ once: true, margin: "-100px" }}
                            className="relative"
                        >
                            {/* Desktop Layout */}
                            <div className="hidden md:flex items-start">
                                {/* Left Side */}
                                <div className="flex-1 pr-8">
                                    {step.position === "left" && (
                                        <div className="text-right">
                                            {/* ID and Title */}
                                            <div className="mb-4">
                                                <span className="text-md font-bold text-black block">
                                                    {step.id}
                                                </span>
                                                <h3 className="text-md sm:text-3xl font-bold text-gray-900 uppercase tracking-wide">
                                                    {step.title}
                                                </h3>
                                            </div>
                                        </div>
                                    )}
                                    {step.position === "right" && (
                                        <div className="text-right">
                                            {/* Description and Image */}
                                            <p className="text-gray-600 text-sm mb-6">
                                                {step.description}
                                            </p>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                whileInView={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.6, delay: index * 0.2 + 0.4 }}
                                                viewport={{ once: true }}
                                                className="w-full max-w-sm ml-auto"
                                            >
                                                <div className="relative bg-white rounded-2xl p-4 shadow-xl">
                                                    <div className="relative bg-gray-900 rounded-2xl p-2">
                                                        <div className="bg-white rounded-xl overflow-hidden">
                                                            <div className="aspect-[9/16] bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                                                                <div className="text-center">
                                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#538EF0] rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                                                        <span className="text-white font-bold text-lg">
                                                                            {index + 1}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="font-semibold text-gray-900 mb-2">
                                                                        {step.title}
                                                                    </h4>
                                                                    <p className="text-sm text-gray-600 px-4">
                                                                        {step.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </div>

                                {/* Center Circle */}
                                <div className="relative z-10 flex-shrink-0">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        whileInView={{ scale: 1 }}
                                        transition={{ duration: 0.4, delay: index * 0.2 + 0.3 }}
                                        viewport={{ once: true }}
                                        className="w-12 h-12 bg-[#538EF0] rounded-full flex items-center justify-center shadow-lg"
                                    >
                                        <span className="text-white font-bold text-sm">
                                            {index + 1}
                                        </span>
                                    </motion.div>
                                </div>

                                {/* Right Side */}
                                <div className="flex-1 pl-8">
                                    {step.position === "right" && (
                                        <div className="text-left">
                                            {/* ID and Title */}
                                            <div className="mb-4">
                                                <span className="text-md font-bold text-black block">
                                                    {step.id}
                                                </span>
                                                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 uppercase tracking-wide">
                                                    {step.title}
                                                </h3>
                                            </div>
                                        </div>
                                    )}
                                    {step.position === "left" && (
                                        <div className="text-left">
                                            {/* Description and Image */}
                                            <p className="text-gray-600 text-sm mb-6">
                                                {step.description}
                                            </p>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                whileInView={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.6, delay: index * 0.2 + 0.4 }}
                                                viewport={{ once: true }}
                                                className="w-full max-w-sm"
                                            >
                                                <div className="relative bg-white rounded-2xl p-4 shadow-xl">
                                                    <div className="relative bg-gray-900 rounded-2xl p-2">
                                                        <div className="bg-white rounded-xl overflow-hidden">
                                                            <div className="aspect-[9/16] bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                                                                <div className="text-center">
                                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#538EF0] rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                                                        <span className="text-white font-bold text-lg">
                                                                            {index + 1}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="font-semibold text-gray-900 mb-2">
                                                                        {step.title}
                                                                    </h4>
                                                                    <p className="text-sm text-gray-600 px-4">
                                                                        {step.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Layout */}
                            <div className="md:hidden">
                                {/* Mobile Circle - positioned to align with left line */}
                                <div className="flex items-start">
                                    <div className="relative z-10 flex-shrink-0">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            whileInView={{ scale: 1 }}
                                            transition={{ duration: 0.4, delay: index * 0.2 + 0.3 }}
                                            viewport={{ once: true }}
                                            className="w-12 h-12 bg-[#538EF0] rounded-full flex items-center justify-center shadow-lg"
                                        >
                                            <span className="text-white font-bold text-sm">
                                                {index + 1}
                                            </span>
                                        </motion.div>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 ml-6">
                                        {/* ID and Title Row */}
                                        <div className="mb-4">
                                            <span className="text-4xl font-bold text-black block">
                                                {step.id}
                                            </span>
                                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 uppercase tracking-wide">
                                                {step.title}
                                            </h3>
                                        </div>
                                        
                                        {/* Description */}
                                        <p className="text-gray-600 text-small mb-6">
                                            {step.description}
                                        </p>
                                        
                                        {/* Image */}
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.6, delay: index * 0.2 + 0.4 }}
                                            viewport={{ once: true }}
                                            className="w-full max-w-sm mb-6"
                                        >
                                            <div className="relative bg-white rounded-2xl p-4 shadow-xl">
                                                <div className="relative bg-gray-900 rounded-2xl p-2">
                                                    <div className="bg-white rounded-xl overflow-hidden">
                                                        <div className="aspect-[9/16] bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                                                            <div className="text-center">
                                                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#538EF0] rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                                                    <span className="text-white font-bold text-lg">
                                                                        {index + 1}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-12 sm:mt-16 md:mt-20">
                <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-xl mx-auto mb-4 sm:mb-6">
                    Join the Innovation Revolution Today
                </h3>
                <p className="text-base sm:text-small text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
                    Become part of a vibrant community of innovators. Together, we can create impactful solutions.
                </p>
                <button className="bg-[#4B89EF] text-white px-6 py-2 rounded-md font-semibold text-md hover:bg-blue-700 transition-colors">
                    Get Started
                </button>
            </div>
        </div>
    );
}
