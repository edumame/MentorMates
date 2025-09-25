"use client";

import Image from "next/image";
import React from "react";
import clsx from "clsx";

export type LogoItem = { alt: string; src: string; href?: string };

type MarqueeProps = {
  logos: LogoItem[];
  itemHeightClass?: string;
  className?: string;
  speed?: number;
  speedMobile?: number;
  reverse?: boolean;
  fade?: boolean;
  pauseOnHover?: boolean;
};

export function LogoMarquee({
  logos,
  itemHeightClass = "h-6 sm:h-8 lg:h-10",
  className = "h-10 sm:h-12 lg:h-16",
  speed = 24,
  speedMobile = 20,
  reverse = false,
  fade = true,
  pauseOnHover = true,
}: MarqueeProps) {
  const track = [...logos, ...logos]; // duplicate to remove loop seam

  return (
    <div className={clsx("relative w-full max-w-full overflow-hidden", className)}>
      {/* optional edge fade */}
      {fade && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-white to-transparent" />
        </>
      )}

      <div
        className={clsx(
          "flex w-max min-w-full items-center gap-6 sm:gap-10 lg:gap-16",
          "will-change-transform transform-gpu",
          reverse ? "marquee-reverse" : "marquee",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
        aria-hidden // decorative
      >
        {track.map((item, i) => (
          <div key={`${item.src}-${i}`} className="shrink-0">
            <Image
              alt={item.alt}
              src={item.src}
              width={240}
              height={80}
              className={clsx(
                "block w-auto select-none opacity-80 hover:opacity-100 transition-opacity",
                itemHeightClass
              )}
              priority={i < 6}
            />
          </div>
        ))}
      </div>

      {/* Keyframes + durations (no Tailwind config required) */}
      <style jsx global>{`
        @keyframes _marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes _marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee {
          animation: _marquee ${speedMobile}s linear infinite;
        }
        .marquee-reverse {
          animation: _marquee-reverse ${speedMobile}s linear infinite;
        }
        @media (min-width: 640px) {
          .marquee { animation-duration: ${speed}s; }
          .marquee-reverse { animation-duration: ${speed}s; }
        }
      `}</style>
    </div>
  );
}
