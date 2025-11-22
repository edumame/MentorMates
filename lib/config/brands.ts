import type { CSSProperties } from "react";

type LogoVariantName = "default" | "dark" | "mark";
export type BrandLogoPlacement = "navbar" | "auth" | "footer" | "email" | "favicon";

export interface BrandLogoAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
  priority?: boolean;
}

export interface BrandLogoPlacementConfig {
  variant: LogoVariantName;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export interface BrandPartnerLogo {
  alt: string;
  src: string;
  width?: number;
  height?: number;
}

export interface BrandAssets {
  placeholders: {
    projectCover: string;
    avatar: string;
  };
  icons: Record<string, string>;
  backgrounds: Record<string, string>;
  illustrations: Record<string, string>;
  partnerLogos: BrandPartnerLogo[];
}

export interface BrandingConfig {
  key: string;
  name: string;
  meta: {
    title: string;
    description: string;
    shortName: string;
    tagline?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    favicon?: string;
  };
  palette: {
    primary: string;
    primaryRgb: string;
    primaryStrong: string;
    primaryStrongRgb: string;
    accent: string;
    accentRgb: string;
    background: string;
    surface: string;
    surfaceSoft: string;
    text: string;
    textMuted: string;
    textDark: string;
    textSecondary: string;
    gradientHero: [string, string, string];
    gradientBanner: [string, string];
  };
  cssVars: Record<string, string>;
  logo: {
    defaultVariant: LogoVariantName;
    variants: Record<LogoVariantName, BrandLogoAsset>;
    placements: Partial<Record<BrandLogoPlacement, BrandLogoPlacementConfig>>;
  };
  assets: BrandAssets;
  urls: {
    mentorForm: string;
    discordInvite?: string;
    substack?: string;
    support?: string;
  };
  social: {
    instagram?: string;
    x?: string;
    linkedin?: string;
  };
}

const BRAND_DEFINITIONS = {
  mentormates: {
    key: "mentormates",
    name: "MentorMates",
    meta: {
      title: "MentorMates",
      description: "MentorMates connects organizers, mentors, and participants with modern hackathon tooling.",
      shortName: "MentorMates",
      tagline: "Build more feedback-friendly hackathons",
      primaryCtaLabel: "Join the next hackathon",
      primaryCtaHref: "/events",
      favicon: "/mentormate.png",
    },
    palette: {
      primary: "#4B89EF",
      primaryRgb: "75 137 239",
      primaryStrong: "#3F77D3",
      primaryStrongRgb: "63 119 211",
      accent: "#6E56CF",
      accentRgb: "110 86 207",
      background: "#FFFFFF",
      surface: "#FBFCFE",
      surfaceSoft: "#F1F7FE",
      text: "#0F172A",
      textMuted: "#7F7F7F",
      textDark: "#4C4C4C",
      textSecondary: "#575D65",
      gradientHero: ["#DBEAFE", "#4286F4", "#1C64F2"],
      gradientBanner: ["#DBEAFE", "#F9F9FF"],
    },
    cssVars: {
      "--background": "0 0% 100%",
      "--foreground": "0 0% 0%",
      "--card": "0 0% 100%",
      "--card-foreground": "0 0% 0%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "0 0% 0%",
      "--primary": "217 84% 62%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "0 0% 100%",
      "--secondary-foreground": "0 0% 30%",
      "--muted": "0 0% 100%",
      "--muted-foreground": "0 0% 45%",
      "--accent": "0 0% 100%",
      "--accent-foreground": "0 0% 10%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "0 0% 98%",
      "--border": "0 0% 0% / 0.15",
      "--input": "0 0% 0% / 0.15",
      "--ring": "217 84% 62%",
      "--chart-1": "217 84% 62%",
      "--chart-2": "210 100% 50%",
      "--chart-3": "28 61% 36%",
      "--chart-4": "0 0% 90%",
      "--chart-5": "0 0% 47%",
      "--radius": "0.5rem",
      "--sidebar-background": "0 0% 100%",
      "--sidebar-foreground": "0 0% 10%",
      "--sidebar-primary": "217 84% 62%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "0 0% 100%",
      "--sidebar-accent-foreground": "0 0% 10%",
      "--sidebar-border": "0 0% 0% / 0.15",
      "--sidebar-ring": "217 84% 62%",
      "--brand-primary-hex": "#4B89EF",
      "--brand-primary-rgb": "75 137 239",
      "--brand-primary-strong-hex": "#3F77D3",
      "--brand-primary-strong-rgb": "63 119 211",
      "--brand-primary-tint-hex": "#DBEAFE",
      "--brand-primary-soft-hex": "#E9F0FF",
      "--brand-primary-wash-hex": "#F9F9FF",
      "--brand-accent-hex": "#6E56CF",
      "--brand-accent-rgb": "110 86 207",
      "--brand-warning-hex": "#B98500",
      "--brand-warning-soft-hex": "#FFF2B8",
      "--brand-surface-hex": "#FBFCFE",
      "--brand-surface-soft-hex": "#F1F7FE",
      "--brand-text-muted-hex": "#7F7F7F",
      "--brand-text-dark-hex": "#4C4C4C",
      "--brand-text-secondary-hex": "#575D65",
      "--brand-gradient-hero-start": "#DBEAFE",
      "--brand-gradient-hero-mid": "#4286F4",
      "--brand-gradient-hero-end": "#1C64F2",
      "--brand-gradient-banner-start": "#DBEAFE",
      "--brand-gradient-banner-end": "#F9F9FF",
    },
    logo: {
      defaultVariant: "default",
      variants: {
        default: { src: "/mentormate.png", width: 200, height: 40, alt: "MentorMates logo" },
        dark: { src: "/mentormate.png", width: 200, height: 40, alt: "MentorMates logo (dark)" },
        mark: { src: "/mentormate.png", width: 64, height: 64, alt: "MentorMates mark" },
      },
      placements: {
        navbar: { variant: "default", width: 180, height: 40, className: "object-contain pl-2" },
        auth: { variant: "default", width: 200, height: 40, className: "object-contain" },
        footer: { variant: "dark", width: 200, height: 40 },
        email: { variant: "default", width: 160, height: 40 },
        favicon: { variant: "mark", width: 64, height: 64 },
      },
    },
    assets: {
      placeholders: {
        projectCover: "/img/placeholder.png",
        avatar: "/testimonials/avatarFallback.png",
      },
      icons: {
        sparkles: "/brand/shared/sparkles.svg",
      },
      backgrounds: {
        hero: "/brand/mentormates/backgrounds/hero.svg",
        auth: "/brand/mentormates/backgrounds/hero.svg",
      },
      illustrations: {
        emptyState: "/brand/mentormates/backgrounds/hero.svg",
      },
      partnerLogos: [
        { alt: "Tencent", src: "/partners/tencent.png" },
        { alt: "Goodnotes", src: "/partners/goodnotes.png" },
        { alt: "Inspirit AI", src: "/partners/inspirit.png" },
        { alt: "Johns Hopkins University", src: "/partners/jhu.png" },
        { alt: "Stanford", src: "/partners/stanford.png" },
        { alt: "HKPU", src: "/partners/hkpu.png" },
      ],
    },
    urls: {
      mentorForm: "https://docs.google.com/forms/d/e/1FAIpQLSeKK8E8B63Sl4J0fjJZKDz3QdWImSqkrwPym-_EN6K2kcizsw/viewform",
      discordInvite: "https://discord.gg/6pbUzK44eW",
      substack: "https://mentormates.substack.com",
      support: "mailto:hello@mentormates.org",
    },
    social: {
      instagram: "https://www.instagram.com/mentormates.official",
      x: "https://x.com/mentormates?s=11",
      linkedin: "https://www.linkedin.com/in/mentor-mates-a6898036b/",
    },
  } satisfies BrandingConfig,
  solstice: {
    key: "solstice",
    name: "Solstice Labs",
    meta: {
      title: "Solstice Labs",
      description: "Solstice Labs powers pop-up innovation labs with a bold orange + midnight palette.",
      shortName: "Solstice",
      tagline: "Bold experiments, brighter launches",
      primaryCtaLabel: "Schedule a lab",
      primaryCtaHref: "/contact",
      favicon: "/brand/solstice/mark.svg",
    },
    palette: {
      primary: "#FF6B35",
      primaryRgb: "255 107 53",
      primaryStrong: "#F3A712",
      primaryStrongRgb: "243 167 18",
      accent: "#F4F1DE",
      accentRgb: "244 241 222",
      background: "#0B192F",
      surface: "#1D3557",
      surfaceSoft: "#2B2D42",
      text: "#F4F1DE",
      textMuted: "#FDEBD3",
      textDark: "#F4F1DE",
      textSecondary: "#A8B2C9",
      gradientHero: ["#0B192F", "#1D3557", "#2B2D42"],
      gradientBanner: ["#FF6B35", "#F3A712"],
    },
    cssVars: {
      "--background": "217 62% 11%",
      "--foreground": "52 50% 91%",
      "--card": "215 50% 23%",
      "--card-foreground": "52 50% 91%",
      "--popover": "215 50% 23%",
      "--popover-foreground": "52 50% 91%",
      "--primary": "16 100% 60%",
      "--primary-foreground": "34 91% 91%",
      "--secondary": "52 50% 91%",
      "--secondary-foreground": "215 50% 23%",
      "--muted": "235 21% 21%",
      "--muted-foreground": "52 50% 91%",
      "--accent": "46 100% 50%",
      "--accent-foreground": "217 62% 11%",
      "--destructive": "0 80% 45%",
      "--destructive-foreground": "52 50% 91%",
      "--border": "215 35% 32%",
      "--input": "215 35% 32%",
      "--ring": "16 100% 60%",
      "--chart-1": "16 100% 60%",
      "--chart-2": "215 50% 40%",
      "--chart-3": "46 100% 50%",
      "--chart-4": "52 50% 91%",
      "--chart-5": "235 21% 21%",
      "--radius": "0.5rem",
      "--sidebar-background": "215 50% 23%",
      "--sidebar-foreground": "52 50% 91%",
      "--sidebar-primary": "16 100% 60%",
      "--sidebar-primary-foreground": "52 50% 91%",
      "--sidebar-accent": "235 21% 21%",
      "--sidebar-accent-foreground": "52 50% 91%",
      "--sidebar-border": "235 21% 21%",
      "--sidebar-ring": "16 100% 60%",
      "--brand-primary-hex": "#FF6B35",
      "--brand-primary-rgb": "255 107 53",
      "--brand-primary-strong-hex": "#F3A712",
      "--brand-primary-strong-rgb": "243 167 18",
      "--brand-primary-tint-hex": "#F3A712",
      "--brand-primary-soft-hex": "#FDEBD3",
      "--brand-primary-wash-hex": "#FDEBD3",
      "--brand-accent-hex": "#F4F1DE",
      "--brand-accent-rgb": "244 241 222",
      "--brand-warning-hex": "#FFC300",
      "--brand-warning-soft-hex": "#FDEBD3",
      "--brand-surface-hex": "#1D3557",
      "--brand-surface-soft-hex": "#2B2D42",
      "--brand-text-muted-hex": "#FDEBD3",
      "--brand-text-dark-hex": "#F4F1DE",
      "--brand-text-secondary-hex": "#A8B2C9",
      "--brand-gradient-hero-start": "#0B192F",
      "--brand-gradient-hero-mid": "#1D3557",
      "--brand-gradient-hero-end": "#2B2D42",
      "--brand-gradient-banner-start": "#FF6B35",
      "--brand-gradient-banner-end": "#F3A712",
    },
    logo: {
      defaultVariant: "default",
      variants: {
        default: { src: "/brand/solstice/logo.svg", width: 220, height: 60, alt: "Solstice Labs logo" },
        dark: { src: "/brand/solstice/logo-dark.svg", width: 220, height: 60, alt: "Solstice Labs logo (dark)" },
        mark: { src: "/brand/solstice/mark.svg", width: 64, height: 64, alt: "Solstice Labs mark" },
      },
      placements: {
        navbar: { variant: "default", width: 200, height: 48, className: "object-contain" },
        auth: { variant: "dark", width: 200, height: 48 },
        footer: { variant: "dark", width: 200, height: 48 },
        email: { variant: "default", width: 160, height: 40 },
        favicon: { variant: "mark", width: 64, height: 64 },
      },
    },
    assets: {
      placeholders: {
        projectCover: "/img/placeholder.png",
        avatar: "/testimonials/avatarFallback.png",
      },
      icons: {
        sparkles: "/brand/shared/sparkles.svg",
      },
      backgrounds: {
        hero: "/brand/solstice/backgrounds/hero.svg",
        auth: "/brand/solstice/backgrounds/hero.svg",
      },
      illustrations: {
        emptyState: "/brand/solstice/backgrounds/hero.svg",
      },
      partnerLogos: [
        { alt: "Solstice Hardware", src: "/partners/stanford.png" },
        { alt: "Nova Robotics", src: "/partners/jhu.png" },
        { alt: "Sunrise Ventures", src: "/partners/tencent.png" },
      ],
    },
    urls: {
      mentorForm: "https://example.com/solstice/mentor",
      discordInvite: "https://discord.gg/example",
      substack: "https://solstice-labs.example.com",
      support: "mailto:hello@solstice-labs.io",
    },
    social: {
      instagram: "https://instagram.com/solstice-labs",
      x: "https://x.com/solstice-labs",
      linkedin: "https://linkedin.com/company/solstice-labs",
    },
  } satisfies BrandingConfig,
} as const;

export const BRANDS = BRAND_DEFINITIONS;
export type BrandKey = keyof typeof BRANDS;
export const BRAND_KEYS = Object.keys(BRANDS) as BrandKey[];
export const DEFAULT_BRAND_KEY: BrandKey = "mentormates";

const getEnvBrandKey = (): string | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env.NEXT_PUBLIC_BRAND_KEY ?? process.env.BRAND_KEY;
};

export const resolveBrandKey = (key?: string | null): BrandKey => {
  const candidate = (key ?? getEnvBrandKey()) as BrandKey | undefined;
  if (candidate && candidate in BRANDS) {
    return candidate;
  }
  return DEFAULT_BRAND_KEY;
};

export const getBranding = (key?: string | null): BrandingConfig => {
  const brandKey = resolveBrandKey(key);
  return BRANDS[brandKey];
};

export const ACTIVE_BRAND = getBranding();

export const getBrandCssVariables = (brand: BrandingConfig): CSSProperties => {
  return Object.entries(brand.cssVars).reduce((acc, [cssVar, value]) => {
    acc[cssVar as keyof CSSProperties] = value;
    return acc;
  }, {} as CSSProperties & Record<string, string>);
};
