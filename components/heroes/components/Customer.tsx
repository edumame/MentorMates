"use client";

import Image from "next/image";

export function Customer() {
    const testimonials = [
        {
            id: 1,
            rating: 5,
            quote: "These young entrepreneurs will thrive if they have the 'meta AI competency' mindset as early on as their high school age. Also, I am hoping that they will generate unique foundational questions that will lead to learning, change, and innovation.",
            author: "Paul Kim",
            title: "Former Associate Dean, Stanford Graduate School of Education",
            avatar: "/testimonials/paul.png",
            logo: "/testimonials/stanfordedu.png"
        },
        {
            id: 2,
            rating: 5,
            quote: "This Hackathon provided invaluable insight - especially bridging the stigma of AI/Technology and providing foundational knowledge for these competitions.",
            author: "Peter Song",
            title: "Participant, Hong Kong",
            avatar: "/testimonials/avatarFallback.png"
        },
        {
            id: 3,
            rating: 5,
            quote: "I've been to a LOT of hackathons, both as a judge and as a hacker. And all the speakers were excellent and brought creativity and efficiency I'd never seen before. These days were super enjoyable and responsive to feedback. They know how to ask the right questions better; looking forward to their next exciting things.",
            author: "Quincy Larson",
            title: "Founder & Teacher, FreeCodeCamp.org",
            avatar: "/testimonials/quincy.png",
            logo: "/testimonials/freecode.png"
        }
    ];

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <span
                key={i}
                className={`text-md ${i < rating ? 'text-[#944524]' : 'text-gray-300'}`}
            >
                ★
            </span>
        ));
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-24 py-8 sm:py-12 lg:py-16 bg-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12 lg:mb-16">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                        Customer testimonials
                    </h2>
                </div>

                {/* Testimonials Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {testimonials.map((testimonial) => (
                        <div
                            key={testimonial.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                            {/* Star Rating */}
                            <div className="flex items-center mb-3 sm:mb-4">
                                {renderStars(testimonial.rating)}
                            </div>

                            {/* Quote */}
                            <blockquote className="text-gray-700 text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">
                                "{testimonial.quote}"
                            </blockquote>

                            {/* Author Info */}
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                    {testimonial.avatar ? (
                                        <Image 
                                            src={testimonial.avatar} 
                                            alt={`${testimonial.author} avatar`} 
                                            width={40} 
                                            height={40}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                            <span className="text-white font-semibold text-xs sm:text-sm">
                                                {testimonial.author.split(' ').map(n => n[0]).join('')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Author Details */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm sm:text-base">
                                        {testimonial.author}
                                    </p>
                                    <p className="text-gray-600 text-xs sm:text-sm">
                                        {testimonial.title}
                                    </p>
                                </div>
                            </div>

                            {/* Company Logo */}
                            {testimonial.logo && (
                                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4">
                                    <div className="flex items-center">
                                        <div className="h-4 sm:h-6 flex items-center">
                                            <Image 
                                                src={testimonial.logo} 
                                                alt={`${testimonial.author} company logo`} 
                                                width={200} 
                                                height={200}
                                                className="w-auto object-contain"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
