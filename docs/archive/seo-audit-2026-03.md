# SEO Audit Fixes — mentormates.ai

Audit date: 2026-03-14
Starting score: **35/100**

## Critical Issues (must fix)

- [x] **1. No Open Graph tags** — Social shares show generic preview with no image
- [x] **2. No Twitter Card tags** — Twitter/X shares have no rich preview
- [x] **3. No `robots.txt`** — Returns 404, search engines have no crawl directives
- [x] **4. No `sitemap.xml`** — Returns 404, Google/Bing can't discover pages
- [x] **5. No canonical URL** — Duplicate content risk (`mentormates.ai` vs `www.mentormates.ai`)
- [x] **6. Title too short & generic** — "MentorMates" is 11 chars, no keywords

## Warnings (should fix)

- [x] **7. Meta description too short** — 46 chars (ideal: 150-160), not compelling
- [x] **8. No structured data (JSON-LD)** — No schema markup found
- [x] **9. Duplicate viewport meta tag** — Two identical viewport tags in `<head>`
- [x] **10. No `<link rel="icon">` in head** — Favicon only defined in manifest
- [x] **11. Manifest uses wrong path** — `manifest.webmanifest` in layout but file is `manifest.json`

## Implementation approach

Using TDD: write tests for each SEO requirement first, then implement fixes to make tests pass.
