import { Hero } from "@/components/about/Hero";
import { Mission } from "@/components/about/Mission";
import { Impact } from "@/components/heroes/components/Impact";
import { Team } from "@/components/about/Team";
import { LogoCarousel } from "@/components/heroes/components/LogoCarousel";
import { CTA } from "@/components/heroes/components/CTA";
import { Footer } from "@/components/layout/footer";

export default function AboutPage() {
  return <>
    <Hero />
    <Mission />
    <Impact />
    <Team />
    <LogoCarousel />
    <CTA />
    <Footer />
  </>;
}