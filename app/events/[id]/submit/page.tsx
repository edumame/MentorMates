import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Direct submission link: /events/[id]/submit
 * Redirects to the project submission form with the event pre-filled.
 * Share this link with participants for one-click project submission.
 */
export default async function EventSubmitPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/submit?eventId=${encodeURIComponent(id)}`);
}
