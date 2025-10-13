"use client";

import Image from "next/image";
import Link from "next/link";
import { SERVICES_SECTIONS, type ServiceSectionData } from "./content";
import { MaterialIcon } from "@/components/MaterialIcon";
import { Button } from "@/components/ui/button";
import { LogoCarousel } from "@/components/heroes/components/LogoCarousel";
import { Customer } from "@/components/heroes/components/Customer";

export function Host() {
  const sections = SERVICES_SECTIONS.map((s, i) => ({
    ...s,
    imageSide: s.imageSide ?? (i % 2 === 0 ? "right" : "left"),
  }));

  return (
    <section className="bg-white">
      {/* Hero */}
      <div className="px-4 sm:px-6 py-16 sm:py-20 md:py-24 min-h-[400px]">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gray-900">
            Build a Culture of Creative Innovation Across Your Teams
          </h1>
          <p className="mt-4 sm:mt-6 text-gray-700 text-base sm:text-lg max-w-4xl mx-auto">
            Run internal vibathons, host a lifetime of maker projects, and amplify team creativity — all on one platform.
          </p>
          <div className="mt-6 sm:mt-8 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <Button variant="default" asChild>
              <Link href="https://calendly.com/edumameofficial/30min" target="_blank" rel="noopener noreferrer">
                Schedule a Demo for Your Team
              </Link>
            </Button>
            {/* <Button variant="defaultGray" asChild>
              <Link href="/projects">Explore the Project Marketplace</Link>
            </Button> */}
          </div>
        </div>
      </div>

      {/* Sections (mobile: text first, image second) */}
      <div className="px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto space-y-16 md:space-y-24">
          {sections.map((s) => (
            <ServiceRow key={s.id} data={s} />
          ))}

          {/* Social Proof / Case Studies */}
          <div className="space-y-10">
            {/* Logos */}
            <div className="bg-white">
              <div>
                <LogoCarousel />
              </div>
            </div>

            {/* Testimonials grid (existing component) */}
            <div>
              <Customer />
            </div>

            {/* Metrics callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { stat: "20+", desc: "prototypes delivered in 4 weeks" },
                { stat: "3", desc: "cross-team hires sparked" },
                { stat: "+7%", desc: "retention lift reported" },
              ].map((m) => (
                <div key={m.desc} className="text-center border border-gray-200 rounded-xl p-6">
                  <div className="text-4xl font-bold text-gray-900">{m.stat}</div>
                  <div className="mt-2 text-gray-700">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Final Push CTA */}
      <div className="px-4 sm:px-6 pb-16 sm:pb-20 md:pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900">
              Ready to build your first vibathon?
            </h2>
            <p className="mt-3 text-gray-700 max-w-3xl mx-auto">
              Let’s run a pilot together. Enjoy concierge support and co-design for your first cycle.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="https://calendly.com/edumameofficial/30min" target="_blank" rel="noopener noreferrer">Schedule a Demo</Link>
              </Button>
            </div>
          </div>
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
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-10 lg:gap-16">
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
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {data.bullets.map((b, i) => (
              <div key={i} className="flex flex-col items-start gap-3">
                <div className="flex items-center justify-center">
                  <MaterialIcon
                    name={b.icon?.name ?? ""}
                    className="text-[64px] text-black"
                    title={b.title}
                  />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                    {b.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.cta && (
          <div className="mt-6">
            <Button asChild variant="defaultGray">
              <Link href={data.cta.href}>{data.cta.label}</Link>
            </Button>
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
    <div className="relative mx-auto w-full max-w-[500px] aspect-[25/32]">
      <div className="absolute inset-0 rounded-[22px] overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 90vw, 500px"
          priority={false}
        />
      </div>
    </div>
  );
}
