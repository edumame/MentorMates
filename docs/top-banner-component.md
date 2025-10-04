# Top Banner Component Guide (Next.js + Tailwind)

This short guide shows how to add a polished top-of-page announcement banner using the existing components in this repo. It covers a quick start, customization, accessibility, and common gotchas.

## Quick start: show a banner on the homepage only

Use the prebuilt `AnnouncementBanner` already wired into the app layout via `ConditionalAnnouncement`.

- File: `components/layout/ConditionalAnnouncement.tsx`
- It renders the banner only on `/` and avoids SSR hydration mismatches.
- Layout already includes it: see `app/layout.tsx`.

No action needed if you want the current homepage banner behavior.

## Add a banner to all pages

If you want the banner across the entire app, replace `ConditionalAnnouncement` with `AnnouncementBanner` in `app/layout.tsx`.

```tsx
// app/layout.tsx
// ...existing imports
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Replace ConditionalAnnouncement with a permanent banner */}
        <AnnouncementBanner />
        {/* Existing nav and providers */}
        {/* ... */}
        {children}
      </body>
    </html>
  );
}
```

## Customize content and style

`components/layout/AnnouncementBanner.tsx` uses `StickyBanner` and is fully client-side with a dismiss button. Edit the inner JSX to change the message, link, or gradient styles.

```tsx
// components/layout/AnnouncementBanner.tsx
<StickyBanner 
  className="fixed inset-x-0 top-0 z-[60]" 
  style={{ background: 'linear-gradient(to right, #C375FE, #5EC7FC)' }}
>
  {/* Change message and link here */}
</StickyBanner>
```

- **Color & gradient**: Update the inline `style` or replace with Tailwind classes.
- **CTA**: Swap the `Link` to point to internal routes or external URLs.
- **Dismiss**: The built-in close button hides the banner for the session.

## Alternative: simple link-style banner

There is also a minimal banner variant at `components/ui/announcement-banner.tsx` that accepts props for `href`, `message`, and `ctaText`.

```tsx
import { AnnouncementBanner as LinkBanner } from "@/components/ui/announcement-banner";

<LinkBanner href="/ai-vibe-guide" message="We just launched the AI Vibe Guide" ctaText="View guide" />
```

This variant is not fixed; you can wrap it with a container and position it as needed.

## Prevent layout overlap with fixed header

`StickyBanner` computes its height and sets a CSS variable `--banner-h` on `:root`. Use it to offset other fixed headers or the page content so nothing is hidden under the banner.

```css
/* app/globals.css or a component-level style */
:root { --banner-h: 0px; }
.header-fixed { top: var(--banner-h); }
.main-with-banner { padding-top: var(--banner-h); }
```

Then apply these classes or inline styles to your header and main wrapper.

## Accessibility

- The close button includes `aria-label`.
- For link-style banners, ensure the `<Link>` has an informative `aria-label` when the text alone is not descriptive.
- Maintain sufficient color contrast for text over gradients.

## SSR considerations

- Client-only rendering is used to avoid hydration flashes; see `ConditionalAnnouncement`.
- If rendering globally, keep it early in `app/layout.tsx` before the navbar.

## Common tweaks

- **Show on specific routes only**: Update the pathname checks in `ConditionalAnnouncement`.
- **Animate in/out**: `StickyBanner` uses `framer-motion`; adjust `transition`/`animate` props in `components/ui/sticky-banner.tsx`.
- **Z-index conflicts**: It uses `z-[60]`; raise or lower if needed relative to your nav/modals.

## Testing checklist

- Banner appears on intended routes only
- No content hidden behind the banner; offsets applied
- Links work and open correctly (internal vs external)
- Dismiss button hides the banner
- Mobile layout: text truncation and tap targets are acceptable
