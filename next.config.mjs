/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["clinicalmindai.stanford.edu", "mentormates.ai"],
  },

  skipTrailingSlashRedirect: true,
};

export default nextConfig;
