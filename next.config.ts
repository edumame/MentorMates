import withPWA from "next-pwa";

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'clinicalmindai.stanford.edu',
      'static.wikia.nocookie.net',
      'zipbooks.com',
      'www.capitalopportunitiesnc.org',
      'upload.wikimedia.org',
      'www.prideindustries.com',
      'encrypted-tbn0.gstatic.com',
      'www.computersciencedegreehub.com',
      'collegeaim.org',
    ],
  },
};

const config = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);

export default config;
