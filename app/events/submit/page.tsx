import { Footer } from "@/components/layout/Footer";
import { SubmitEventForm } from "./submit-form";

export const dynamic = "force-static";

export const metadata = {
  title: "Submit Event — MentorMates",
  description:
    "Submit your event for placement on the MentorMates events calendar. Open to anyone — no sign-in required.",
};

export default function SubmitEventPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-xl px-5 py-12 lg:py-16">
        <h1 className="font-geist text-[32px] sm:text-[36px] font-semibold tracking-[-0.04em] text-black">
          Submit Event
        </h1>
        <p className="mt-2 text-[15px] text-[rgba(0,0,0,0.65)]">
          Submit your event for placement on the MentorMates events calendar. An admin will review your submission and reach out to your email.
        </p>
        <div className="mt-8">
          <SubmitEventForm />
        </div>
      </div>
      <Footer />
    </>
  );
}
