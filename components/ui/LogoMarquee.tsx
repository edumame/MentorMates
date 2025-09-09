import React from "react";
import Image from "next/image";

export type LogoItem = { src: string; alt: string };

type Props = {
  logos: LogoItem[];
  className?: string;
  /** Tailwind height classes for <img> (default: "h-6 sm:h-8 lg:h-10") */
  itemHeightClass?: string;
  /** Seconds for one full loop (default: 24) */
  speed?: number;
  /** Optional mobile speed (seconds). If not set, uses `speed`. */
  speedMobile?: number;
  /** Reverse direction (default: false) */
  reverse?: boolean;
  /** Edge fades / mask gradient (default: true) */
  fade?: boolean;
  /** Pause animation on hover (default: true) */
  pauseOnHover?: boolean;
};

export function LogoMarquee({
  logos,
  className = "",
  itemHeightClass = "h-6 sm:h-8 lg:h-10",
  speed = 24,
  speedMobile,
  reverse = false,
  fade = true,
  pauseOnHover = true,
}: Props) {
  // CSS vars let us support responsive speed without inline media queries
  const styleVars: React.CSSProperties = {
    ["--mm-speed" as string]: `${speed}s`,
    ["--mm-speed-mobile" as string]: `${speedMobile ?? speed}s`,
  };

  return (
    <div
      className={`relative w-full overflow-hidden ${
        pauseOnHover ? "group" : ""
      } ${className}`}
      style={
        fade
          ? {
              ...styleVars,
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }
          : styleVars
      }
    >
      {/* Optional soft edge fades (visual only) */}
      {fade && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 sm:w-10 lg:w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 sm:w-10 lg:w-16 bg-gradient-to-l from-white to-transparent z-10" />
        </>
      )}

      {/* Absolute track — transforms never affect layout width */}
      <div
        className={`mm-track absolute left-0 top-0 h-full w-[200%] ${
          reverse ? "mm-reverse" : "mm-forward"
        } ${pauseOnHover ? "group-[.group]:hover:[animation-play-state:paused]" : ""}`}
      >
        {/* First half */}
        <ul className="mm-half left-0">
          {logos.map((l, i) => (
            <li key={`a-${i}`} className="mm-item">
              <Image
                src={l.src}
                alt={l.alt}
                width={120}
                height={40}
                className={`block ${itemHeightClass} w-auto object-contain`}
                loading="lazy"
              />
            </li>
          ))}
        </ul>
        {/* Second half (duplicate for seamless loop) */}
        <ul className="mm-half left-1/2">
          {logos.map((l, i) => (
            <li key={`b-${i}`} className="mm-item">
              <Image
                src={l.src}
                alt={l.alt}
                width={120}
                height={40}
                className={`block ${itemHeightClass} w-auto object-contain`}
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        .mm-track {
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-duration: var(--mm-speed);
        }
        .mm-forward {
          animation-name: mmMarquee;
        }
        .mm-reverse {
          animation-name: mmMarqueeReverse;
        }
        .mm-half {
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          display: flex;
          align-items: center;
          gap: 1.5rem; /* ~24px */
          padding-left: 0.25rem;
          padding-right: 0.25rem;
        }
        .mm-item {
          display: flex;
          align-items: center;
          height: 100%;
          flex: 0 0 auto; /* no shrink */
        }
        @keyframes mmMarquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes mmMarqueeReverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
        /* Mobile speed override (if provided) */
        @media (max-width: 640px) {
          .mm-track {
            animation-duration: var(--mm-speed-mobile);
          }
        }
        /* Accessibility: honor reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .mm-track {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
