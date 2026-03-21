import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";
import daisyui from "daisyui";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* Font families */
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        geist: ["Geist", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "host-h2": [
          "52px",
          { lineHeight: "1.2", letterSpacing: "-0.06em" },
        ],
        "host-h6": [
          "22px",
          { lineHeight: "1.4", letterSpacing: "-0.06em" },
        ],
        "host-lg": ["18px", { lineHeight: "1.5" }],
        "host-base": ["16px", { lineHeight: "1.5" }],
        "host-sm": ["14px", { lineHeight: "20px" }],
      },
      maxWidth: {
        host: "1280px",
      },
      /* Brand palette */
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },

        /* === Brand families (usable as utilities) ===
			-> e.g. bg-jacksons-purple, bg-jacksons-purple-dark, text-pattens-blue-light, etc.
			*/
        neutral: {
          white: "var(--neutral-white)",
          lightest: "var(--neutral-lightest)",
          lighter: "var(--neutral-lighter)",
          light: "var(--neutral-light)",
          DEFAULT: "var(--neutral)",
          dark: "var(--neutral-dark)",
          darker: "var(--neutral-darker)",
          darkest: "var(--neutral-darkest)",
        },
        jacksons: {
          purple: {
            lightest: "var(--jacksons-purple-lightest)",
            lighter: "var(--jacksons-purple-lighter)",
            light: "var(--jacksons-purple-light)",
            DEFAULT: "var(--jacksons-purple)",
            dark: "var(--jacksons-purple-dark)",
            darker: "var(--jacksons-purple-darker)",
            darkest: "var(--jacksons-purple-darkest)",
          },
        },
        pattens: {
          blue: {
            lightest: "var(--pattens-blue-lightest)",
            lighter: "var(--pattens-blue-lighter)",
            light: "var(--pattens-blue-light)",
            DEFAULT: "var(--pattens-blue)",
            dark: "var(--pattens-blue-dark)",
            darker: "var(--pattens-blue-darker)",
            darkest: "var(--pattens-blue-darkest)",
          },
        },
        cumin: {
          lightest: "var(--cumin-lightest)",
          lighter: "var(--cumin-lighter)",
          light: "var(--cumin-light)",
          DEFAULT: "var(--cumin)",
          dark: "var(--cumin-dark)",
          darker: "var(--cumin-darker)",
          darkest: "var(--cumin-darkest)",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography, daisyui],
};

export default config;
