import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { HomePageClient } from "./HomePageClient";

/** Keep landing content in the initial HTML while client authentication resolves. */
export default function HomePage() {
  return (
    <HomePageClient>
      <div className="min-h-screen w-full">
        <LandingHero />
        <ServiceWorkerRegistration />
        <Footer publicPresentation />
      </div>
    </HomePageClient>
  );
}
