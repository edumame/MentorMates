"use client";

import Image from "next/image";
import Link from "next/link";
import { SERVICES_SECTIONS, type ServiceSectionData } from "./content";
import { MaterialIcon } from "@/components/MaterialIcon";

export function Services() {
  const sections = SERVICES_SECTIONS.map((s, i) => ({
    ...s,
    imageSide: s.imageSide ?? (i % 2 === 0 ? "right" : "left"),
  }));

  return (
    <section className="bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-16 sm:py-20 md:py-24">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900">
            Turn your organization to an innovation hub
          </h1>
          <p className="mt-4 sm:mt-6 text-gray-700 text-base sm:text-lg max-w-3xl mx-auto">
            Unlock creativity and innovation with our comprehensive services for organizing successful hackathons.
          </p>
          <div className="mt-6 sm:mt-8">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white bg-[#4B89EF] hover:bg-[#4B89EF]/90 transition-colors"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </div>

      {/* Sections (mobile: text first, image second) */}
      <div className="px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto space-y-16 md:space-y-24">
          {sections.map((s) => (
            <ServiceRow key={s.id} data={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========= subcomponents ========= */

function ServiceRow({ data }: { data: ServiceSectionData }) {
  const imgOnLeft = data.imageSide === "left";

  return (
    // 2 cols on md+, stacked on mobile
    <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-10 lg:gap-16">
      {/* TEXT — mobile first; on desktop it zigzags opposite to image */}
      <div className={`order-1 ${imgOnLeft ? "md:order-2" : "md:order-1"}`}>
        {data.eyebrow && (
          <div className="mb-2 text-sm font-semibold tracking-wide text-gray-700 md:hidden">
            {data.eyebrow}
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
          {data.title}
        </h2>
        <p className="mt-3 sm:mt-4 text-gray-700 leading-relaxed">
          {data.body}
        </p>

        {/* Bullets (optional) */}
        {data.bullets && data.bullets.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {data.bullets.map((b, i) => (
              <div key={i} className="flex flex-col items-start gap-2">
                <MaterialIcon
                  name={b.icon ?? ""}
                  className="text-5xl sm:text-6xl text-gray-900"
                  title={b.title}
                />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {b.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600">{b.body}</p>
              </div>
            ))}
          </div>
        )}

        {data.cta && (
          <div className="mt-6">
            <Link
              href={data.cta.href}
              className="inline-flex items-center text-xs rounded-lg bg-gray-100 px-4 py-2 text-gray-900 hover:bg-gray-200 transition-colors"
            >
              {data.cta.label}
            </Link>
          </div>
        )}
      </div>

      {/* IMAGE — mobile second; on desktop it zigzags */}
      <div className={`order-2 ${imgOnLeft ? "md:order-1" : "md:order-2"}`}>
        <PhoneCard src={data.image.src} alt={data.image.alt} />
      </div>
    </div>
  );
}

/** Phone mock without any gradient background (clean card only) */
function PhoneCard({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[260px] h-[340px] sm:w-[320px] sm:h-[420px] md:w-[380px] md:h-[500px]">
      <div className="relative h-full w-full rounded-[22px] bg-white shadow-xl ring-1 ring-black/5">
        <div className="absolute inset-0 rounded-[22px] overflow-hidden">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 320px, 380px"
            priority={false}
          />
        </div>
        {/* subtle top notch mimic */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 h-5 w-28 rounded-b-2xl bg-black/5" />
      </div>
    </div>
  );
}
