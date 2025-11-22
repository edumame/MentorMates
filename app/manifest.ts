import type { MetadataRoute } from "next";
import { ACTIVE_BRAND } from "@/lib/config/brands";

export default function manifest(): MetadataRoute.Manifest {
  const faviconPlacement = ACTIVE_BRAND.logo.placements.favicon;
  const faviconVariant =
    faviconPlacement?.variant ?? ACTIVE_BRAND.logo.defaultVariant;
  const faviconAsset =
    ACTIVE_BRAND.logo.variants[faviconVariant] ??
    ACTIVE_BRAND.logo.variants[ACTIVE_BRAND.logo.defaultVariant];
  const iconSrc =
    faviconAsset?.src ?? ACTIVE_BRAND.meta.favicon ?? "/mentormate.png";
  const iconType = iconSrc.endsWith(".svg")
    ? "image/svg+xml"
    : iconSrc.endsWith(".png")
      ? "image/png"
      : "image/x-icon";

  return {
    name: ACTIVE_BRAND.meta.title,
    short_name: ACTIVE_BRAND.meta.shortName,
    description: ACTIVE_BRAND.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: ACTIVE_BRAND.palette.background,
    theme_color: ACTIVE_BRAND.palette.primary,
    icons: [
      {
        src: iconSrc,
        sizes: "192x192",
        type: iconType,
      },
      {
        src: iconSrc,
        sizes: "512x512",
        type: iconType,
      },
    ],
  };
}