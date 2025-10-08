/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
