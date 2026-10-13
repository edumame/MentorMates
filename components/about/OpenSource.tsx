import Link from "next/link";
import { OPEN_SOURCE } from "@/lib/config/open-source";

export function OpenSource() {
  return (
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto rounded-2xl border border-gray-200 p-8 sm:p-12 space-y-4">
        <p className="text-sm font-medium tracking-wide">Community</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
          Open source, built with our community
        </h2>
        <p className="text-base sm:text-md leading-relaxed">
          MentorMates is open source under the{" "}
          <Link href={OPEN_SOURCE.LICENSE_PATH} className="underline">
            {OPEN_SOURCE.LICENSE_NAME}
          </Link>
          . We build in the open with the students, mentors, organizers and
          partners who use it, so that support at hackathons stays free and available to every learner.
        </p>
        <p className="text-base sm:text-md leading-relaxed">
          Want to contribute, partner on a hackathon or collaborate? Write to us at{" "}
          <a href={`mailto:${OPEN_SOURCE.CONTACT_EMAIL}`} className="underline">
            {OPEN_SOURCE.CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
