"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

const RESEARCH_CARDS = [
    {
        href: "https://docs.google.com/document/d/1e8TZdqWAMW4qLVIKMk1_2rBf5htl05f3IvtPDITkjj8/edit?tab=t.0#heading=h.71qqxvhhjkscs",
        imageSrc: "/research/r13.png",
        imageAlt: "Hackathon Horizons Research",
        badgeColor: "bg-white",
        badgeText: "Research",
        title: "Hackathon Horizons: Improving Self-Efficacy Through Scaffolded Hackathons"
    },
    {
        href: "https://acceleratelearning.stanford.edu/funding/people-who-help-other-people-learn-pwhopl/",
        imageSrc: "/research/r2.png",
        imageAlt: "MentorMate Feedback Research",
        badgeColor: "bg-white",
        badgeText: "Study",
        title: "MentorMate: Elevate Hackathon Feedback"
    },
    {
        href: "https://acceleratelearning.stanford.edu/story/what-does-ai-mean-for-learners-with-disabilities/",
        imageSrc: "/research/r13.png",
        imageAlt: "Experiential Learning Research",
        badgeColor: "bg-white",
        badgeText: "Toolkit",
        title: "Inclusive by design: Stanford initiative releases new paper that explores how AI can support learners with disabilities"
    }
];

export function Research() {
    const { isAuthenticated } = useAuth();

    return (
        <div className={isAuthenticated ? "min-h-full bg-white" : "bg-white"}>
            <div className={isAuthenticated ? "py-16 px-6" : "py-32 px-6"}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                        <div className="flex-1">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-4">
                                Our research
                            </h1>
                            <p className="text-xs sm:text-base max-w-2xl">
                            At MentorMates, we integrate cutting-edge research on AI and 
                            learning to transform how students innovate. Dive into our insights 
                            to see the science behind our platform.
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="text-sm text-gray-600 mb-2 text-right">Supported by</div>
                            <Link href="https://acceleratelearning.stanford.edu/funding/people-who-help-other-people-learn-pwhopl/" target="_blank" rel="noopener noreferrer">
                                <Image
                                    src="/research/stanfordAccLearning.png"
                                    alt="Research Supporter"
                                    width={150}
                                    height={80}
                                    className="object-contain hover:opacity-80 transition-opacity duration-200"
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Research Cards Section */}
            <div 
                className={`${isAuthenticated ? "py-12" : "py-16"} px-6 bg-gray-50`}
                style={{
                    borderRadius: '96px 96px 0 0',
                    background: 'linear-gradient(194deg, rgba(229, 240, 254, 0.65) 5.42%, rgba(229, 240, 254, 0.42) 87.43%), linear-gradient(0deg, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.20) 100%), linear-gradient(94deg, rgba(247, 246, 242, 0.80) -4.25%, rgba(66, 134, 244, 0.80) 52.72%, rgba(247, 246, 242, 0.80) 107.67%)'
                }}
            >
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {RESEARCH_CARDS.map((card, index) => (
                            <Link 
                                key={index}
                                href={card.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="relative">
                                    <Image
                                        src={card.imageSrc}
                                        alt={card.imageAlt}
                                        width={0}
                                        height={0}
                                        sizes="80vw"
                                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300" />
                                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                                        <div className={`${card.badgeColor} text-xs px-2 py-1 text-black font-semibold rounded mb-3 inline-block`}>
                                            {card.badgeText}
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2">
                                            {card.title}
                                        </h3>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
