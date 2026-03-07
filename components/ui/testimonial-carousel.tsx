"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TESTIMONIALS } from "@/lib/constants/testimonials";

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="inline-flex" role="img" aria-label={`${count} star rating`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
          <path
            d="M10 15.27l-5.18 3.05 1.4-5.98L1 7.97l6.09-.52L10 2.25l2.91 5.2 6.09.52-5.22 4.37 1.4 5.98z"
            fill="#944524"
          />
        </svg>
      ))}
    </div>
  );
}

function useCarousel(total: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [total]);
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);
  return { index, setIndex, prev, next };
}

/** Desktop right-side panel */
export function TestimonialPanelDesktop() {
  const { index, setIndex, prev, next } = useCarousel(TESTIMONIALS.length);
  const t = TESTIMONIALS[index];

  return (
    <aside className="relative hidden lg:flex items-center justify-center bg-sky-50 rounded-l-3xl">
      <div className="mx-auto w-full max-w-2xl px-10 py-10 text-center">
        <Stars />
        <blockquote className="mt-6 text-xl leading-8 text-slate-800">
          <span
            dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }}
          />
        </blockquote>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Image
            src={t.avatar}
            alt={t.author}
            width={56}
            height={56}
            className="rounded-full border border-slate-300"
          />
          <div className="text-sm font-semibold text-slate-900">{t.author}</div>
          <div className="text-sm text-slate-600 max-w-lg">{t.title}</div>
          {t.logo ? (
            <div className="mt-2">
              <Image
                src={t.logo}
                alt="logo"
                width={t.logoWidth}
                height={t.logoHeight}
                className="opacity-90"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            onClick={prev}
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  i === index ? "bg-slate-800" : "bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Mobile testimonial block */
export function TestimonialPanelMobile() {
  const { index, setIndex, prev, next } = useCarousel(TESTIMONIALS.length);
  const t = TESTIMONIALS[index];

  return (
    <section className="lg:hidden mt-6 px-4 pb-6">
      <div className="bg-sky-50 rounded-3xl px-5 py-6 text-center">
        <Stars />
        <blockquote className="mt-3 text-sm leading-6 text-slate-800">
          <span
            dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }}
          />
        </blockquote>

        <div className="mt-4 flex flex-col items-center gap-1.5">
          <Image
            src={t.avatar}
            alt={t.author}
            width={40}
            height={40}
            className="rounded-full border border-slate-300"
          />
          <div className="text-sm font-semibold text-slate-900">{t.author}</div>
          <div className="text-xs text-slate-600 max-w-xs">{t.title}</div>
          {t.logo ? (
            <div className="mt-1">
              <Image
                src={t.logo}
                alt="logo"
                width={t.logoWidth}
                height={t.logoHeight}
                className="opacity-90"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-center gap-8">
          <button
            onClick={prev}
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  i === index ? "bg-slate-800" : "bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
