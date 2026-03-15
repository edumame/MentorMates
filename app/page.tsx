import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import { HomePageClient } from "./HomePageClient";

/**
 * Server component — the landing page content (LandingHero, Footer) is
 * rendered as static HTML at build time, making it visible to search
 * engine crawlers in the initial response.
 *
 * HomePageClient wraps the content and swaps it for the auth dashboard
 * when a user is logged in (client-side only).
 */
export default function HomePage() {
  return (
    <HomePageClient>
      <div className="min-h-screen w-full">
        <LandingHero />
        <ServiceWorkerRegistration />
        <Footer />
      </div>
    </HomePageClient>
  );
}
