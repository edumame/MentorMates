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
            id: "login",
            title: "Login",
            description: "Register with your team or individually and upload your project details",
            image: "/images/login-screen.png",
            position: "right"
        },
        {
            id: "create",
            title: "Create", 
            description: "Build your project with guidance from mentors and access to resources",
            image: "/images/create-screen.png",
            position: "left"
        },
        {
            id: "grow",
            title: "Grow",
            description: "Get feedback from industry experts and improve your skills through collaboration",
            image: "/images/grow-screen.png", 
            position: "right"
        }
    ];

    return (
        <div 
            ref={containerRef}
            className="mx-auto px-10 lg:px-24 py-16"
            style={{
                borderRadius: '112px 112px 0 0',
                background: 'linear-gradient(180deg, rgba(229, 240, 254, 0.65) 0%, rgba(229, 240, 254, 0.42) 96.63%)'
            }}
        >
            {/* Header */}
            <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
                How MentorMates Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Simple steps to turn your ideas into reality with the support of our community
            </p>
            </div>

            {/* Timeline Container */}
            <div className="relative">
            {/* Animated Center Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 bg-gray-300 h-full">
                <motion.div 
                className="w-full bg-blue-600"
                style={{ height: lineHeight }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-24">
                {steps.map((step, index) => (
                <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.2 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className={`flex items-center ${
                    step.position === "left" 
                        ? "flex-row-reverse" 
                        : "flex-row"
                    } gap-8 lg:gap-16`}
                >
                    {/* Content Side */}
                    <div className={`flex-1 ${
                    step.position === "left" ? "text-right" : "text-left"
                    }`}>
                    <div className={`max-w-md ${
                        step.position === "left" ? "ml-auto" : "mr-auto"
                    }`}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                        {step.title}
                        </h3>
                        <p className="text-gray-600 text-lg leading-relaxed">
                        {step.description}
                        </p>
                    </div>
                    </div>

                    {/* Center Circle */}
                    <div className="relative z-10">
                    <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: index * 0.2 + 0.3 }}
                        viewport={{ once: true }}
                        className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                        <span className="text-white font-bold text-lg">
                        {index + 1}
                        </span>
                    </motion.div>
                    </div>

                    {/* Image Side */}
                    <div className="flex-1">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: index * 0.2 + 0.4 }}
                        viewport={{ once: true }}
                        className={`max-w-md ${
                        step.position === "left" ? "mr-auto" : "ml-auto"
                        }`}
                    >
                        <div className="relative bg-white rounded-2xl p-4 shadow-xl">
                        {/* Phone Frame */}
                        <div className="relative bg-gray-900 rounded-2xl p-2">
                            <div className="bg-white rounded-xl overflow-hidden">
                            {/* Placeholder for now - replace with actual screenshots */}
                            <div className="aspect-[9/16] bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                                <div className="text-center">
                                <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
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
                </motion.div>
                ))}
            </div>
            </div>

            {/* Call to Action */}
            <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-20"
            >
            <h3 className="text-3xl font-bold text-gray-900 mb-6">
                Join the Innovation Revolution Today
            </h3>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Become part of a vibrant community of innovators. Together, we can create impactful solutions.
            </p>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#4B89EF] text-white px-6 py-2 rounded-md font-semibold text-md hover:bg-blue-700 transition-colors"
            >
                Get Started
            </motion.button>
            </motion.div>
        </div>
    );
}
