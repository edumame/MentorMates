"use client";

import Image from "next/image";

export function Customer() {
    const testimonials = [
        {
            id: 1,
            rating: 5,
            quote: "These young entrepreneurs will thrive if they have the 'meta AI competency' mindset as early on as their high school age. Also, I am hoping that they will generate unique foundational questions that will lead to learning, change, and innovation.",
            author: "Paul Kim",
            title: "Director",
            company: "Stanford Graduate School of Education",
            avatar: "/avatars/paul-kim.jpg",
            logo: "/logos/stanford.png"
        },
        {
            id: 2,
            rating: 5,
            quote: "This Hackathon provided invaluable insight - especially bridging the stigma of AI/Technology and providing foundational knowledge for these competitions.",
            author: "Peter Song",
            title: "Participant, Hong Kong",
            avatar: "/avatars/peter-song.jpg"
        },
        {
            id: 3,
            rating: 5,
            quote: "I've been to a LOT of hackathons, both as a judge and as a hacker. And all the speakers were excellent and brought creativity and efficiency I'd never seen before. These days were super enjoyable and responsive to feedback. They know how to ask the right questions better; looking forward to their next exciting things.",
            author: "Cynthia Lemon",
            title: "Founder & Teacher, FreeCodeCamp.org",
            company: "FreeCodeCamp.org",
            avatar: "/avatars/cynthia-lemon.jpg",
            logo: "/logos/freecodecamp.png"
        }
    ];

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <span
                key={i}
                className={`text-sm ${i < rating ? 'text-orange-400' : 'text-gray-300'}`}
            >
                ★
            </span>
        ));
    };

    return (
        <div className="mx-auto px-10 lg:px-24 py-16 bg-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-gray-900 mb-4">
                        Customer testimonials
                    </h2>
                </div>

                {/* Testimonials Grid */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {testimonials.map((testimonial) => (
                        <div
                            key={testimonial.id}
                            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                            {/* Star Rating */}
                            <div className="flex items-center mb-4">
                                {renderStars(testimonial.rating)}
                            </div>

                            {/* Quote */}
                            <blockquote className="text-gray-700 text-sm leading-relaxed mb-6">
                                "{testimonial.quote}"
                            </blockquote>

                            {/* Author Info */}
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                        <span className="text-white font-semibold text-sm">
                                            {testimonial.author.split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                </div>

                                {/* Author Details */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm">
                                        {testimonial.author}
                                    </p>
                                    <p className="text-gray-600 text-xs">
                                        {testimonial.title}
                                    </p>
                                    {testimonial.company && (
                                        <p className="text-gray-500 text-xs">
                                            {testimonial.company}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Company Logo */}
                            {testimonial.logo && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center">
                                        <div className="h-6 flex items-center">
                                            {testimonial.company === 'Stanford Graduate School of Education' && (
                                                <div className="text-red-600 font-bold text-lg">Stanford</div>
                                            )}
                                            {testimonial.company === 'FreeCodeCamp.org' && (
                                                <div className="text-green-600 font-bold text-sm">FreeCodeCamp.org</div>
                                            )}
                                        </div>
                                        {testimonial.company === 'Stanford Graduate School of Education' && (
                                            <div className="ml-2 text-xs text-gray-500 uppercase tracking-wide">
                                                EDUCATION
                                            </div>
                                        )}
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
