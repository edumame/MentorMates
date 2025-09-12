import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/ai-vibe-guide/Hero";
import { AccessOptions } from "@/components/ai-vibe-guide/AccessOptions";
import { ShareForAccessForm } from "@/components/ai-vibe-guide/ShareForAccessForm";

export default function GuideLandingPage() {
  return (
    <section className="relative overflow-hidden">
      <div className="px-5 py-16 md:py-24">
        <Hero />

        <AccessOptions />

        <div className="my-10 text-center text-gray-400">⸻</div>

        <ShareForAccessForm />

        <div className="mt-10 text-center text-sm text-gray-600">
          <p>
            Prefer to support later? Share on LinkedIn and tag{" "}
            <strong>Chinat Yu</strong> to get it free.
          </p>
        </div>
      </div>

      <Footer />
    </section>
  );
}
