"use client";
import React, { SVGProps, useEffect, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";

export const StickyBanner = ({
  className,
  children,
  hideOnScroll = false,
}: {
  className?: string;
  children: React.ReactNode;
  hideOnScroll?: boolean;
}) => {
  const [open, setOpen] = useState(true);
  const { scrollY } = useScroll();

  // Only attach the scroll listener if we actually want to hide on scroll
  useEffect(() => {
    if (!hideOnScroll) return;
    const unsub = scrollY.on("change", (latest) => {
      if (latest > 40) setOpen(false);
      else setOpen(true);
    });
    return () => unsub();
  }, [hideOnScroll, scrollY]);

  return (
    <motion.div
      className={cn(
        // NOTE: no "sticky", no "top-0", no "z-*" here.
        "flex w-full items-center justify-center px-4 py-1 min-h-14",
        className
      )}
      // prevent SSR → first-frame jump
      initial={false}
      // keep opacity constant; just slide in/out vertically
      animate={{ y: open ? 0 : -100 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}

      <motion.button
        initial={false}
        animate={{ scale: 1 }}
        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide announcement" : "Show announcement"}
      >
        <CloseIcon className="h-5 w-5 text-white" />
      </motion.button>
    </motion.div>
  );
};

const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M18 6l-12 12" />
    <path d="M6 6l12 12" />
  </svg>
);
