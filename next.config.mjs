import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// i18n plugin — loads messages via ./i18n/request.ts
// Gated by NEXT_PUBLIC_I18N_ENABLED while we roll out the [locale] routing refactor.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      new URL("https://lpxqfwyqandsortecbvu.supabase.co/**"),
      new URL("https://moinycvhmmzjjtvqijzw.supabase.co/**"),
      new URL("https://zqlopmbodkxlaunmkveo.supabase.co/**"),
      new URL("https://nsxcypmjpizdjxrdncpe.supabase.co/**"),
      new URL("https://clinicalmindai.stanford.edu"),
    ],
  },
  skipTrailingSlashRedirect: true,
  serverExternalPackages: [
    "@stream-io/node-sdk",
    "ws",
  ],
  
  // Subdomain routing for admin panel
  // async rewrites() {
  //   return {
  //     beforeFiles: [
  //       // Rewrite admin subdomain to /admin path
  //       {
  //         source: '/:path*',
  //         has: [
  //           {
  //             type: 'host',
  //             value: 'admin.mentormates.ai',
  //           },
  //         ],
  //         destination: '/admin/:path*',
  //       },
  //     ],
  //   };
  // },

  // // Redirect /admin on main domain to home (admin only via subdomain)
  // async redirects() {
  //   return [
  //     {
  //       source: '/admin/:path*',
  //       has: [
  //         {
  //           type: 'host',
  //           value: '(?!admin\\.).*\\.mentormates\\.ai',
  //         },
  //       ],
  //       destination: '/',
  //       permanent: false,
  //     },
  //     {
  //       source: '/admin/:path*',
  //       has: [
  //         {
  //           type: 'host',
  //           value: 'mentormates.ai',
  //         },
  //       ],
  //       destination: '/',
  //       permanent: false,
  //     },
  //   ];
  // },
};

export default withNextIntl(nextConfig);
