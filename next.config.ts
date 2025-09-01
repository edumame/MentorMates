const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['clinicalmindai.stanford.edu', 'mentormates.com'],
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true, 
};

export default nextConfig;
