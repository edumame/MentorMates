import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { OPEN_SOURCE } from "@/lib/config/open-source";
import { readLicenseText } from "@/lib/license";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${OPEN_SOURCE.LICENSE_NAME} | MentorMates`,
  description: `MentorMates is open source under the ${OPEN_SOURCE.LICENSE_NAME}.`,
};

export default function LicensePage() {
  return (
    <>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{OPEN_SOURCE.LICENSE_NAME}</h1>
        <p className="mt-4 text-base text-gray-700">
          MentorMates is open source. Anyone may use, copy, modify and share it under the terms below.
        </p>
        <pre className="mt-8 whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-800">
          {readLicenseText()}
        </pre>
      </main>
      <Footer />
    </>
  );
}
