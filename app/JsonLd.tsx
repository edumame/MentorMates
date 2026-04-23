export function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MentorMates",
    url: "https://www.mentormates.ai",
    description:
      "MentorMates is the all-in-one platform connecting mentors and students at hackathons, design days, and innovation events.",
    applicationCategory: "Education",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
