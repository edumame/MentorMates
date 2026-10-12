import { SubmitEventPageContent } from "./submit-page-content";

export const dynamic = "force-static";

export const metadata = {
  title: "Submit Event — MentorMates",
  description:
    "Submit your event for placement on the MentorMates events calendar. Open to anyone — no sign-in required.",
};

export default function SubmitEventPage() {
  return <SubmitEventPageContent />;
}
