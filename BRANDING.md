## Branding System

The MentorMates repo now supports multiple brands from a single configuration layer.  
All of the levers for logos, color palette, gradients, and shared assets live in
`lib/config/brands.ts`.

### 1. Define brands

`lib/config/brands.ts` exports:

- `BRANDS`: record of brand configs (ships with `mentormates` + an example `solstice`)
- `BrandingConfig`: type for colors, CSS variables, logos, and assets
- `ACTIVE_BRAND`: the brand that should be used at runtime

Each `BrandingConfig` contains:

- `palette`: hex + rgb strings for primary/secondary colors
- `cssVars`: values injected as CSS custom properties so Tailwind + arbitrary
  values (e.g. `bg-[var(--brand-primary-hex)]`) pick up the active brand
- `logo`: variants + placement sizes for `BrandLogo`
- `assets`: placeholders, partner logos, backgrounds, icons
- `urls` / `social`: central links (mentor form, Discord, Substack, etc.)

Add a new brand by appending to `BRANDS` and giving it a unique `key`.  
Most sites will only need to edit that file to completely restyle the UI.

### 2. Select the active brand

`ACTIVE_BRAND` uses:

```
process.env.NEXT_PUBLIC_BRAND_KEY ?? process.env.BRAND_KEY ?? "mentormates"
```

Set `NEXT_PUBLIC_BRAND_KEY=<brand_key>` in `.env.local` (or `BRAND_KEY` on the
server) to switch the entire app without touching components.

### 3. CSS variables + Tailwind

- `app/layout.tsx` pushes `brand.cssVars` onto `<html style=…>` so every page,
  client or server, receives the same color tokens.
- Tailwind arbitrary values (e.g. `bg-[var(--brand-primary-hex)]`,
  `text-[var(--brand-text-muted-hex)]`, `focus:ring-[rgb(var(--brand-primary-rgb)/0.6)]`)
  now read from those vars.
- New helper vars cover gradients, tints, and rgb triplets so we can build
  alpha/gradient states without hard‑coding hex codes.

### 4. Logos and shared assets

- Use `<BrandLogo placement="navbar" />` (see `components/brand/BrandLogo.tsx`)
  instead of importing PNG/SVGs directly. Placement metadata (size, variant,
  priority) is controlled from the config file.
- Placeholders, custom icons, hero backgrounds, and partner logos now live under
  `ACTIVE_BRAND.assets`. Example usage:
  - project cover fallback: `ACTIVE_BRAND.assets.placeholders.projectCover`
  - partner marquee: `ACTIVE_BRAND.assets.partnerLogos`
  - background images: `ACTIVE_BRAND.assets.backgrounds.hero`

### 5. Updating components

- Colors that previously referenced `#4B89EF`, `#6E56CF`, etc. now rely on CSS
  variables, so palette tweaks do not require per-component changes.
- Navbar/AuthNavbar/Footer/Login/Reset pages render `BrandLogo` and pull CTA
  links/socials from the active brand.
- Event/project placeholders, hero partner logos, gradients, and button styles
  all point at the centralized tokens.

### 6. Adding a new surface

1. Decide whether the new surface needs a logo, color, or asset.
2. If it’s a color/gradient, use one of the existing CSS vars or add a new key
   to `cssVars` (and document it in this file).
3. If it’s a logo/image, add it to `assets` and consume via `ACTIVE_BRAND`.
4. For client components, import the data directly. For shared components, wrap
   the usage in a helper (e.g. `BrandLogo`) to remove the need for repeated code.

With this structure, swapping an entire brand involves editing
`lib/config/brands.ts` and setting an env var. No UI component needs to know
about individual hex codes or asset paths anymore.
