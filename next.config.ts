const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      new URL("https://lpxqfwyqandsortecbvu.supabase.co/**"),
      new URL("https://moinycvhmmzjjtvqijzw.supabase.co/**"),
      new URL("https://zqlopmbodkxlaunmkveo.supabase.co/**"),
      new URL("https://nsxcypmjpizdjxrdncpe.supabase.co/**"),
    ],
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
