import Image, { type ImageProps } from "next/image";
import { ACTIVE_BRAND, type BrandLogoPlacement } from "@/lib/config/brands";
import { cn } from "@/lib/utils";

type BrandLogoProps = Omit<ImageProps, "src" | "alt" | "width" | "height"> & {
  placement?: BrandLogoPlacement;
  variant?: "default" | "dark" | "mark";
  fallbackText?: string;
};

export function BrandLogo({
  placement = "navbar",
  variant,
  fallbackText,
  className,
  ...imageProps
}: BrandLogoProps) {
  const brand = ACTIVE_BRAND;
  const placementConfig = brand.logo.placements[placement];
  const resolvedVariant =
    variant ?? placementConfig?.variant ?? brand.logo.defaultVariant;
  const asset =
    brand.logo.variants[resolvedVariant] ??
    brand.logo.variants[brand.logo.defaultVariant];

  if (!asset) {
    return fallbackText ? <span className={className}>{fallbackText}</span> : null;
  }

  const width = imageProps.width ?? placementConfig?.width ?? asset.width;
  const height = imageProps.height ?? placementConfig?.height ?? asset.height;
  const alt = imageProps.alt ?? asset.alt ?? brand.name;
  const priority =
    imageProps.priority ?? placementConfig?.priority ?? (placement === "navbar");

  return (
    <Image
      {...imageProps}
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn(placementConfig?.className, className)}
    />
  );
}
