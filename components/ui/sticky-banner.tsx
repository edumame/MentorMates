"use client";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const StickyBanner = ({
  className,
  children,
  hideOnScroll = false,
  style,
}: {
  className?: string;
  children: React.ReactNode;
  hideOnScroll?: boolean;
  style?: React.CSSProperties;
}) => {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setVar = () => {
      const h = el.clientHeight;
      document.documentElement.style.setProperty(
        "--banner-h",
        `${open ? h : 0}px`
      );
    };

    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--banner-h");
    };
  }, [open]);

  return (
    <motion.div
      ref={ref}
      className={cn("flex w-full items-center justify-center", className)}
      style={style}
      initial={false}
      animate={{ y: open ? 0 : -100 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};
