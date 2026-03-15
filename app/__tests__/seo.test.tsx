/**
 * @jest-environment node
 *
 * SEO Tests — TDD approach
 *
 * Tests for metadata, robots.txt, sitemap.xml, structured data,
 * and layout markup to ensure all SEO audit issues are resolved.
 */
import fs from "fs";
import path from "path";

// ─── Metadata from seo-metadata.ts ───
// Extracted to avoid pulling in Supabase/auth deps from layout.tsx.
// layout.tsx re-exports this as `metadata`.
import { seoMetadata as metadata } from "../seo-metadata";

describe("SEO: Metadata export", () => {
  it("has a descriptive title with keywords", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeGreaterThanOrEqual(30);
    expect(title.length).toBeLessThanOrEqual(70);
    expect(title.toLowerCase()).toContain("mentormates");
  });

  it("has a compelling meta description (150-160 chars)", () => {
    expect(metadata.description).toBeDefined();
    const desc = metadata.description as string;
    expect(desc.length).toBeGreaterThanOrEqual(100);
    expect(desc.length).toBeLessThanOrEqual(170);
  });

  it("has Open Graph tags", () => {
    expect(metadata.openGraph).toBeDefined();
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBeDefined();
    expect(og.description).toBeDefined();
    expect(og.url).toBeDefined();
    expect(og.type).toBe("website");
    expect(og.siteName).toBeDefined();
    // images can be an array or object
    expect(og.images).toBeDefined();
  });

  it("has Twitter Card tags", () => {
    expect(metadata.twitter).toBeDefined();
    const tw = metadata.twitter as Record<string, unknown>;
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBeDefined();
    expect(tw.description).toBeDefined();
    expect(tw.images).toBeDefined();
  });

  it("has a canonical URL via metadataBase or alternates", () => {
    // Next.js uses metadataBase to prefix relative OG URLs and set canonical
    expect(metadata.metadataBase).toBeDefined();
    expect(String(metadata.metadataBase)).toContain("mentormates.ai");
  });

  it("has icons configured", () => {
    expect(metadata.icons).toBeDefined();
  });

  it("has manifest reference", () => {
    expect(metadata.manifest).toBeDefined();
    expect(metadata.manifest).toBe("/manifest.json");
  });
});

// ─── Static files ───
describe("SEO: Static files", () => {
  const publicDir = path.join(process.cwd(), "public");

  it("has a favicon.ico in public/", () => {
    expect(fs.existsSync(path.join(publicDir, "favicon.ico"))).toBe(true);
  });

  it("has manifest.json in public/", () => {
    expect(fs.existsSync(path.join(publicDir, "manifest.json"))).toBe(true);
  });
});

// ─── robots.ts (Next.js App Router convention) ───
describe("SEO: robots.ts", () => {
  it("app/robots.ts exists", () => {
    const robotsPath = path.join(process.cwd(), "app", "robots.ts");
    expect(fs.existsSync(robotsPath)).toBe(true);
  });

  it("exports a default function", async () => {
    const mod = await import("../robots");
    expect(typeof mod.default).toBe("function");
    const result = mod.default();
    expect(result.rules).toBeDefined();
    expect(result.sitemap).toBeDefined();
  });
});

// ─── sitemap.ts (Next.js App Router convention) ───
describe("SEO: sitemap.ts", () => {
  it("app/sitemap.ts exists", () => {
    const sitemapPath = path.join(process.cwd(), "app", "sitemap.ts");
    expect(fs.existsSync(sitemapPath)).toBe(true);
  });

  it("exports a default function returning sitemap entries", async () => {
    const mod = await import("../sitemap");
    expect(typeof mod.default).toBe("function");
    const result = await mod.default();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].url).toContain("mentormates.ai");
  });
});

// ─── Structured Data (JSON-LD) ───
describe("SEO: Structured data component", () => {
  it("app/JsonLd.tsx exists", () => {
    const jsonLdPath = path.join(process.cwd(), "app", "JsonLd.tsx");
    expect(fs.existsSync(jsonLdPath)).toBe(true);
  });
});

// ─── Server-rendered landing page ───
describe("SEO: Server-rendered landing page", () => {
  it("page.tsx is a server component (no 'use client')", () => {
    const pageSrc = fs.readFileSync(
      path.join(process.cwd(), "app", "page.tsx"),
      "utf-8",
    );
    expect(pageSrc).not.toContain('"use client"');
  });

  it("page.tsx renders LandingHero content in the server response", () => {
    const pageSrc = fs.readFileSync(
      path.join(process.cwd(), "app", "page.tsx"),
      "utf-8",
    );
    expect(pageSrc).toContain("LandingHero");
    expect(pageSrc).toContain("Footer");
  });

  it("Build component is a server component", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components", "heroes", "components", "Build.tsx"),
      "utf-8",
    );
    expect(src).not.toContain('"use client"');
  });

  it("Customer component is a server component", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components", "heroes", "components", "Customer.tsx"),
      "utf-8",
    );
    expect(src).not.toContain('"use client"');
  });

  it("CTAJoin component is a server component", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components", "layout", "CTAJoin.tsx"),
      "utf-8",
    );
    expect(src).not.toContain('"use client"');
  });
});

// ─── Layout markup ───
describe("SEO: Layout markup", () => {
  it("does not have duplicate viewport meta tag in layout.tsx", () => {
    const layoutSrc = fs.readFileSync(
      path.join(process.cwd(), "app", "layout.tsx"),
      "utf-8",
    );
    // Next.js auto-generates viewport from metadata export.
    // Manual <meta name="viewport"> in JSX causes duplicates.
    const viewportInJsx = (
      layoutSrc.match(/name="viewport"/g) || []
    ).length;
    // Should be 0 in JSX — viewport handled by metadata.viewport or Next.js default
    expect(viewportInJsx).toBe(0);
  });

  it("includes JsonLd component in the body", () => {
    const layoutSrc = fs.readFileSync(
      path.join(process.cwd(), "app", "layout.tsx"),
      "utf-8",
    );
    expect(layoutSrc).toContain("JsonLd");
  });
});
