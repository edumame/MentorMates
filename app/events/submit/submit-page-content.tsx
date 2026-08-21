"use client";

import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { SubmitEventForm } from "./submit-form";

// Signed-out visitors see the marketing layout (fixed navbar overlay + footer),
// which needs the large top offset. Signed-in users get the sidebar layout,
// where that offset is just dead space.
export function SubmitEventPageContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <div
        className={
          isAuthenticated
            ? "mx-auto w-full max-w-xl px-5 pt-8 pb-12"
            : "mx-auto w-full max-w-xl px-5 pt-28 pb-12 lg:pt-32 lg:pb-16"
        }
      >
        <h1 className="font-geist text-[32px] sm:text-[36px] font-semibold tracking-[-0.04em] text-black">
          Submit Your Event
        </h1>
        <p className="mt-2 text-[15px] text-[rgba(0,0,0,0.65)]">
          MentorMates is the one-stop shop for Silicon Valley resources — and
          listing your hackathon here is more than a calendar spot. We connect
          organizers to sponsors from YC, a16z (Speedrun), and the latest AI
          startups actively looking to get in front of builders. Last year
          alone, we helped organizers raise over $100,000 from leading AI
          companies. We also help your hackers: our core focus is talent
          development and access — connecting builders to top incubators and
          accelerators so your event creates real career momentum. Submit your
          event below and our team will reach out to connect you with the right
          resources.
        </p>
        <div className="mt-8">
          <SubmitEventForm />
        </div>
      </div>
      {!isAuthenticated && <Footer />}
    </>
  );
}
