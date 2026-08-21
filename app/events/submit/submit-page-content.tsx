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
          Got a hackathon coming up? Get it in front of builders who are
          actually looking for events to join. List it on the MentorMates
          events calendar — we&apos;ll send attendees straight to your own
          registration page. No sign-in needed to submit. Once an admin
          reviews it, we&apos;ll reach out to your email to get it live.
        </p>
        <div className="mt-8">
          <SubmitEventForm />
        </div>
      </div>
      {!isAuthenticated && <Footer />}
    </>
  );
}
