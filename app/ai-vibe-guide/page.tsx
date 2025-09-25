import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/ai-vibe-guide/Hero";
import { AccessOptions } from "@/components/ai-vibe-guide/AccessOptions";
import { ShareForAccessForm } from "@/components/ai-vibe-guide/ShareForAccessForm";
import { CTAJoin } from "@/components/layout/CTAJoin";

export default function GuideLandingPage() {
  return (
    <section className="relative overflow-hidden">
      <div className="px-5 py-8 md:py-16">
        <Hero />

        <AccessOptions />

        <ShareForAccessForm />

        <div className="text-center text-sm text-gray-600">
          <p>
            Prefer to support later? Share on LinkedIn and tag{" "}
            <strong>Chinat Yu</strong> to get access.
          </p>
        </div>
      </div>

      <CTAJoin />
      <Footer />
    </section>
  );
}