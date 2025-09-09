"use client";

import Image from "next/image";
import Link from "next/link";
import { Linkedin } from "lucide-react";

export function Team() {
    const team = [
        {
            name: "Chinat Yu",
            title: "CEO & Founder",
            image: "/img/team/chinat.jpg",
            linkedin: "https://www.linkedin.com/in/chinat-yu/",
        },
        {
            name: "Kristen Blair",
            title: "Faculty Advisor",
            image: "/img/team/kristen.jpg",
            linkedin: "https://www.linkedin.com/in/kristen-blair-33454311/",
        },
        {
            name: "Glenn Fajardo",
            title: "Faculty Advisor",
            image: "/img/team/glenn.jpg",
            linkedin: "https://www.linkedin.com/in/glenn-fajardo-532174143/",
        },
        {
            name: "Chris Piech",
            title: "Faculty Advisor",
            image: "/img/team/chris.jpg",
            linkedin: "https://www.linkedin.com/in/chris-piech-45678901/",
        },
        {
            name: "Aurelia Sindhunirmala",
            title: "Research Intern",
            image: "/img/team/lia.jpg",
            linkedin: "https://www.linkedin.com/in/aurelia-sindhunirmala/",
        },
        {
            name: "Jeffery Zhou",
            title: "Research Intern",
            image: "/img/team/jeffery.jpg",
            linkedin: "https://www.linkedin.com/in/jeffery-zhou-b8523816a/",
        },
    ];

    return (
        <div className="bg-[#F1F7FE] py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                        Our Team
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Meet the passionate individuals behind MentorMates.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
                    {team.map((member) => (
                        <div key={member.name} className="text-center">
                            <div className="relative mb-4 mx-auto w-32 h-32 lg:w-40 lg:h-40">
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
                            <p className="text-gray-600 mb-3">
                                {member.title}
                            </p>
                            <Link 
                                href={member.linkedin} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-10 h-10 bg-[#4B89EF] hover:bg-[#4B89EF]/90 text-white rounded-full transition-colors"
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