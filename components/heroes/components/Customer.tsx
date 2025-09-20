"use client";

import Image from "next/image";

export function Customer() {
  const testimonials = [
    {
      id: 1,
      rating: 5,
      quote:
        'Those young entrepreneurs will thrive if they have the "meta AI competency" which I coined at the SXSW a few years ago. Also, I am hoping that they will generate unique foundational questions that will lead to learning, change, and innovation.',
      author: "Paul Kim",
      title: "Former Associate Dean, Stanford Graduate School of Education",
      avatar: "/testimonials/paul.png",
      logo: "/testimonials/stanfordedu.png",
      logoWidth: 117,
      logoHeight: 66,
    },
    {
      id: 2,
      rating: 5,
      quote:
        "This Hackathon provided invaluable insight &mdash; especially bridging the stigma of how you need crazy computer science knowledge for these competitions.",
      author: "Elina Les",
      title: "Participant, Hong Kong",
      avatar: "/testimonials/avatarFallback.png",
      logo: undefined,
      logoWidth: 220,
      logoHeight: 48,
    },
    {
      id: 3,
      rating: 5,
      quote:
        "I've been to a LOT of hackathons, both as a judge and as a hacker. And at the MentorMates hackathon, I saw a level of creativity and efficiency I'd never seen before. These devs were super pragmatic and responsive to feedback. They knew how to ask the right questions before rolling up their sleeves and getting things done.",
      author: "Quincy Larson",
      title: "Founder & Teacher, freeCodeCamp.org",
      avatar: "/testimonials/quincy.png",
      logo: "/testimonials/freecode.png",
      logoWidth: 189,
      logoHeight: 21,
    },
  ];

  return (
    <section className="w-full bg-white py-12 sm:py-16 lg:py-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <header className="mb-10">
          <h2 className="text-3xl md:text-5xl font-semibold text-black font-geist tracking-[-0.06em]">
            Customer testimonials
          </h2>
        </header>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {testimonials.map((t) => (
            <article key={t.id} className="max-w-none">
              {/* Stars */}
              <div className="flex gap-1 mb-4 text-[#B65A2B]">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i} className="text-2xl md:text-3xl leading-none">
                    {s}
                  </span>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-black text-[14px] md:text-[15px] lg:text-[16px] leading-6">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Author col */}
              <div className="mt-6 flex flex-col items-left gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0">
                  {t.avatar ? (
                    <Image
                      src={t.avatar}
                      alt={`${t.author} avatar`}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-white">
                      {t.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-sm md:text-base font-semibold text-gray-900">
                    {t.author}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">{t.title}</p>
                </div>
              </div>

              {/* Logo (optional) */}
              {t.logo && (
                <div className="mt-4">
                  <Image
                    src={t.logo}
                    alt={`${t.author} organization`}
                    width={t.logoWidth}
                    height={t.logoHeight}
                    className="w-1/4 h-1/4 object-contain"
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
