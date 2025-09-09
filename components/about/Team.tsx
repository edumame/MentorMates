"use client";

import Image from "next/image";
import Link from "next/link";
import { Linkedin } from "lucide-react";

export function Team() {
    const team = [
        {
            name: "Chinat Yu",
            title: "CEO & Founder",
            image: "/img/Chinat.png",
            linkedin: "https://www.linkedin.com/in/chinat-yu/",
        },
        {
            name: "Kristen Blair",
            title: "Faculty Advisor",
            image: "/img/Kristen.png",
            linkedin: "https://www.linkedin.com/in/kristen-blair-33454311/",
        },
        {
            name: "Glenn Fajardo",
            title: "Faculty Advisor",
            image: "/img/Glenn.png",
            linkedin: "https://www.linkedin.com/in/glenn-fajardo-532174143/",
        },
        {
            name: "Chris Piech",
            title: "Faculty Advisor",
            image: "/img/ChrisPiech.jpg",
            linkedin: "https://www.linkedin.com/in/chris-piech-45678901/",
        },
        {
            name: "Aurelia Sindhunirmala",
            title: "Research Intern",
            image: "/img/Lia.png",
            linkedin: "https://www.linkedin.com/in/aurelia-sindhunirmala/",
        },
        {
            name: "Jeffery Zhou",
            title: "Research Intern",
            image: "/img/Jeffery.png",
            linkedin: "https://www.linkedin.com/in/jeffery-zhou-b8523816a/",
        },
    ];

    return (
        <div className="bg-[#F1F7FE] py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                        Our Team
                    </h1>
                    <p className="text-md text-gray-600 max-w-2xl mx-auto">
                        Meet the passionate individuals behind MentorMates.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-18">
                    {team.map((member) => (
                        <div key={member.name} className="text-center">
                            <div className="relative mb-4 mx-auto w-16 h-16 lg:w-20 lg:h-20">
                                <Image 
                                    src={member.image} 
                                    alt={member.name} 
                                    fill
                                    className="rounded-full object-cover"
                                    sizes="(max-width: 1024px) 128px, 160px"
                                />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-1">
                                {member.name}
                            </h2>
                            <p className="text-gray-600 text-sm mb-2">
                                {member.title}
                            </p>
                            <Link 
                                href={member.linkedin} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8"
                                aria-label={`${member.name}'s LinkedIn profile`}
                            >
                                <Linkedin className="w-5 h-5" />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}