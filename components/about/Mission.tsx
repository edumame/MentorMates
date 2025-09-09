"use client";

import Image from "next/image";

export function Mission() {
    return (
        <div className="bg-white py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
                    {/* Left Side - Content */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <p className="text-sm font-medium tracking-wide">
                                Mission
                            </p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                                Built for students, with a mission to empower
                            </h2>
                            <p className="text-base sm:text-md leading-relaxed">
                                MentorMates was born from the synergy of student experience and 
                                innovative research. Through meaningful project-based learning, we aim to 
                                provide the personalized feedback and resources you need to not just 
                                participate, but to truly excel in hackathons, demo days, and 
                                innovation challenges.
                            </p>
                        </div>
                    </div>

                    {/* Right Side - Image */}
                    <div className="lg:order-last">
                        <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[450px]">
                            <Image
                                src="/img/missionImg.png"
                                alt="Students collaborating on projects at MentorMates"
                                fill
                                className="rounded-2xl object-cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
