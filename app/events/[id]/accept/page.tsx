import { JoinEventButton } from "@/components/events/join-event-button";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select("event_id, event_name, event_blurb");

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error } = await query.single();

  if (error || !eventData) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 flex flex-col items-center text-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">
        You're invited to {eventData.event_name}
      </h1>
      {eventData.event_blurb && (
        <p className="max-w-xl mb-8 text-gray-700">
          {eventData.event_blurb}
        </p>
      )}
      <JoinEventButton
        eventId={eventData.event_id}
        eventName={eventData.event_name}
        label="I Accept This Hackathon"
      />
    </div>
  );
}
