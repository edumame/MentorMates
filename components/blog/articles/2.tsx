import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";

export default function Article2() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Article 2</h1>
      <p className="mb-8 text-slate-700">
        This is a placeholder for article 2.
      </p>
      <CTAJoin />
      <Footer />
    </div>
  );
}
