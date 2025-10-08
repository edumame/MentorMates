import { Hero } from "@/components/about/Hero";
import { Mission } from "@/components/about/Mission";
import { Impact } from "@/components/heroes/components/Impact";
import { Team } from "@/components/about/Team";
import { LogoCarousel } from "@/components/heroes/components/LogoCarousel";
import { EventHighlights } from "@/components/about/EventHighlights";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <>
      <Hero />
      <Mission />
      <Impact />
      <Team />
      <LogoCarousel />
      <EventHighlights />
      <CTAJoin />
      <Footer />
    </>
  );
}
