"use client";

import { useCallback, useEffect, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Default when no URL or when the remote image fails to load (corrupt / 404). */
export const PROJECT_COVER_PLACEHOLDER = "/img/placeholder.png" as const;

type CoverImageWithFallbackProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  /** Remote or local URL; null/undefined uses placeholder immediately */
  src: string | null | undefined;
};

export function CoverImageWithFallback({
  src,
  alt,
  className,
  referrerPolicy,
  ...rest
}: CoverImageWithFallbackProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  const effectiveSrc =
    !src || loadFailed ? PROJECT_COVER_PLACEHOLDER : src;

  const onError = useCallback(() => {
    setLoadFailed(true);
  }, []);

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      onError={onError}
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      {...rest}
    />
  );
}

type ProjectCoverHeroProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
};

/** Full-bleed cover using an `<img>` so failed loads can fall back (CSS `background-image` cannot). */
export function ProjectCoverHero({
  src,
  alt,
  className,
  imageClassName,
  children,
}: ProjectCoverHeroProps) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <CoverImageWithFallback
        src={src}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-center",
          imageClassName
        )}
      />
      {children}
    </div>
  );
}
